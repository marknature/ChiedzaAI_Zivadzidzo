"""Train a small, reproducible portfolio for aggregate skill-readiness insight.

This is deliberately not a neural-network showcase: it compares strong, explainable
tabular baselines and exports the best held-out macro-F1 / lowest-MAE artifacts.
"""
import json
from datetime import datetime, timezone
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from ml_config import GAP_TARGET, INDUSTRY4_FEATURES, INDUSTRY4_FILE, MODELS_DIR, RANDOM_STATE, READINESS_TARGET, TEST_SIZE

def preprocessing(frame):
    numeric = frame.select_dtypes(include="number").columns.tolist()
    categorical = [column for column in frame.columns if column not in numeric]
    return ColumnTransformer([
        ("numeric", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric),
        ("categorical", Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical),
    ], sparse_threshold=0)

def classify(X_train, X_test, y_train, y_test):
    candidates = {
        "dummy": DummyClassifier(strategy="prior"),
        "logistic_regression": LogisticRegression(max_iter=600, class_weight="balanced"),
        "random_forest": RandomForestClassifier(n_estimators=250, min_samples_leaf=3, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1),
        "hist_gradient_boosting": HistGradientBoostingClassifier(max_iter=250, learning_rate=0.08, random_state=RANDOM_STATE),
    }
    results, fitted = {}, {}
    for name, estimator in candidates.items():
        model = Pipeline([("preprocess", preprocessing(X_train)), ("model", estimator)])
        model.fit(X_train, y_train)
        prediction = model.predict(X_test)
        results[name] = {"accuracy": round(accuracy_score(y_test, prediction), 4), "balanced_accuracy": round(balanced_accuracy_score(y_test, prediction), 4), "macro_f1": round(f1_score(y_test, prediction, average="macro"), 4)}
        fitted[name] = model
    best = max(results, key=lambda name: results[name]["macro_f1"])
    return best, fitted[best], results

def regress(X_train, X_test, y_train, y_test):
    candidates = {
        "dummy": DummyRegressor(strategy="mean"),
        "ridge": Ridge(alpha=2.0),
        "random_forest": RandomForestRegressor(n_estimators=250, min_samples_leaf=3, random_state=RANDOM_STATE, n_jobs=-1),
        "hist_gradient_boosting": HistGradientBoostingRegressor(max_iter=250, learning_rate=0.08, random_state=RANDOM_STATE),
    }
    results, fitted = {}, {}
    for name, estimator in candidates.items():
        model = Pipeline([("preprocess", preprocessing(X_train)), ("model", estimator)])
        model.fit(X_train, y_train)
        prediction = model.predict(X_test)
        results[name] = {"mae": round(mean_absolute_error(y_test, prediction), 4), "rmse": round(mean_squared_error(y_test, prediction) ** 0.5, 4), "r2": round(r2_score(y_test, prediction), 4)}
        fitted[name] = model
    best = min(results, key=lambda name: results[name]["mae"])
    return best, fitted[best], results

def main():
    data = pd.read_csv(INDUSTRY4_FILE)
    X = data[INDUSTRY4_FEATURES].copy()
    X_train, X_test, y_train, y_test = train_test_split(X, data[READINESS_TARGET], test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=data[READINESS_TARGET])
    readiness_name, readiness_model, readiness_results = classify(X_train, X_test, y_train, y_test)
    gap_train, gap_test, gap_y_train, gap_y_test = train_test_split(X, data[GAP_TARGET], test_size=TEST_SIZE, random_state=RANDOM_STATE)
    gap_name, gap_model, gap_results = regress(gap_train, gap_test, gap_y_train, gap_y_test)
    joblib.dump(readiness_model, MODELS_DIR / "industry4_readiness_classifier.joblib")
    joblib.dump(gap_model, MODELS_DIR / "industry4_skill_gap_regressor.joblib")
    metadata = {"created_at": datetime.now(timezone.utc).isoformat(), "dataset": INDUSTRY4_FILE.name, "row_count": len(data), "deployment_scope": "aggregate curriculum/skill insight only; no individual learner prediction", "readiness": {"target": READINESS_TARGET, "winner": readiness_name, "results": readiness_results}, "skill_gap": {"target": GAP_TARGET, "winner": gap_name, "results": gap_results}}
    (MODELS_DIR / "industry4_model_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))

if __name__ == "__main__":
    main()
