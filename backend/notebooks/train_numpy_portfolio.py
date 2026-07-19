"""Dependency-light ZivaDzidzo model portfolio.

Uses only NumPy (already available locally) so it can train during a hackathon without
heavy native dependencies. Artifacts are transparent JSON consumed by Node later.
"""
import csv, json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw" / "industry4_vocational_skill_mapping_dataset.csv"
MODELS = ROOT / "models"
MODELS.mkdir(exist_ok=True)
FEATURES = ["Theory_Score", "Assignment_Score", "Internal_Exam_Score", "Attendance_Percentage", "LMS_Login_Count", "LMS_Time_Spent_Hours", "Lab_Task_Completion_Percentage", "Lab_Accuracy_Score", "Practical_Exam_Score", "Simulation_Score", "Troubleshooting_Score", "AI_Skill_Score", "IoT_Skill_Score", "Robotics_Skill_Score", "Data_Analytics_Score", "Automation_Skill_Score", "Problem_Solving_Score", "Teamwork_Score", "Communication_Score"]
RNG = np.random.default_rng(42)

def load():
    rows = list(csv.DictReader(RAW.open(encoding="utf-8")))
    X = np.array([[float(row[column]) for column in FEATURES] for row in rows], dtype=float)
    labels = np.array([row["Skill_Readiness_Level"] for row in rows])
    gap = np.array([float(row["Skill_Gap_Score"]) for row in rows])
    return X, labels, gap

def macro_f1(y_true, y_pred, labels):
    values = []
    for label in labels:
        tp = np.sum((y_true == label) & (y_pred == label)); fp = np.sum((y_true != label) & (y_pred == label)); fn = np.sum((y_true == label) & (y_pred != label))
        precision = tp / (tp + fp) if tp + fp else 0; recall = tp / (tp + fn) if tp + fn else 0
        values.append(2 * precision * recall / (precision + recall) if precision + recall else 0)
    return float(np.mean(values))

def softmax(scores):
    shifted = scores - scores.max(axis=1, keepdims=True); exp = np.exp(shifted); return exp / exp.sum(axis=1, keepdims=True)

def main():
    X, labels, gap = load(); classes = np.unique(labels); order = RNG.permutation(len(X)); split = int(len(X) * .8); train, test = order[:split], order[split:]
    X_train, X_test, y_train, y_test = X[train], X[test], labels[train], labels[test]
    mean, scale = X_train.mean(axis=0), X_train.std(axis=0); scale[scale == 0] = 1
    Z_train, Z_test = (X_train - mean) / scale, (X_test - mean) / scale
    majority = max(classes, key=lambda label: np.sum(y_train == label)); majority_pred = np.full(len(y_test), majority)
    centroids = np.array([Z_train[y_train == label].mean(axis=0) for label in classes]); centroid_pred = classes[np.argmin(((Z_test[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2), axis=1)]
    indices = np.array([np.where(classes == value)[0][0] for value in y_train]); Y = np.eye(len(classes))[indices]; W = np.zeros((Z_train.shape[1], len(classes))); b = np.zeros(len(classes))
    for _ in range(300):
        probabilities = softmax(Z_train @ W + b); W -= .08 * (Z_train.T @ (probabilities - Y) / len(Z_train) + .001 * W); b -= .08 * (probabilities - Y).mean(axis=0)
    softmax_pred = classes[np.argmax(Z_test @ W + b, axis=1)]
    classification = {"majority_baseline": {"accuracy": round(float((majority_pred == y_test).mean()), 4), "macro_f1": round(macro_f1(y_test, majority_pred, classes), 4)}, "nearest_centroid": {"accuracy": round(float((centroid_pred == y_test).mean()), 4), "macro_f1": round(macro_f1(y_test, centroid_pred, classes), 4)}, "softmax_regression": {"accuracy": round(float((softmax_pred == y_test).mean()), 4), "macro_f1": round(macro_f1(y_test, softmax_pred, classes), 4)}}
    best_classifier = max(classification, key=lambda key: classification[key]["macro_f1"])
    y_gap_train, y_gap_test = gap[train], gap[test]; intercept_train = np.c_[np.ones(len(Z_train)), Z_train]; intercept_test = np.c_[np.ones(len(Z_test)), Z_test]
    mean_pred = np.full(len(y_gap_test), y_gap_train.mean()); linear_coef = np.linalg.pinv(intercept_train) @ y_gap_train; ridge_coef = np.linalg.solve(intercept_train.T @ intercept_train + .5 * np.eye(intercept_train.shape[1]), intercept_train.T @ y_gap_train)
    regression = {"mean_baseline": {"mae": round(float(np.abs(mean_pred - y_gap_test).mean()), 4)}, "linear_regression": {"mae": round(float(np.abs(intercept_test @ linear_coef - y_gap_test).mean()), 4)}, "ridge_regression": {"mae": round(float(np.abs(intercept_test @ ridge_coef - y_gap_test).mean()), 4)}}
    best_regressor = min(regression, key=lambda key: regression[key]["mae"])
    artifact = {"version": "industry4_numpy_v1", "created_at": datetime.now(timezone.utc).isoformat(), "dataset": RAW.name, "rows": int(len(X)), "features": FEATURES, "privacy_scope": "aggregate curriculum and skills insight only; not for individual learner decisions", "normalization": {"mean": mean.tolist(), "scale": scale.tolist()}, "classification": {"classes": classes.tolist(), "selected": best_classifier, "metrics": classification, "majority_label": str(majority), "centroids": centroids.tolist(), "softmax_weights": W.tolist(), "softmax_bias": b.tolist()}, "regression": {"selected": best_regressor, "metrics": regression, "mean": float(y_gap_train.mean()), "linear_coefficients": linear_coef.tolist(), "ridge_coefficients": ridge_coef.tolist()}}
    (MODELS / "industry4_numpy_model.json").write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(json.dumps({"classifier": {"selected": best_classifier, "metrics": classification}, "regressor": {"selected": best_regressor, "metrics": regression}, "artifact": "industry4_numpy_model.json"}, indent=2))

if __name__ == "__main__": main()
