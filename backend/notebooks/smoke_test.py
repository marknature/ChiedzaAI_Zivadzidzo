"""Fast integration check for exported aggregate-skill models."""
import json
import joblib
import pandas as pd
from ml_config import INDUSTRY4_FEATURES, INDUSTRY4_FILE, MODELS_DIR

def main():
    assert (MODELS_DIR / "industry4_model_metadata.json").exists(), "Run train_industry4.py first."
    frame = pd.read_csv(INDUSTRY4_FILE, nrows=3)[INDUSTRY4_FEATURES]
    readiness = joblib.load(MODELS_DIR / "industry4_readiness_classifier.joblib").predict(frame)
    gap = joblib.load(MODELS_DIR / "industry4_skill_gap_regressor.joblib").predict(frame)
    assert len(readiness) == len(frame) == len(gap)
    assert all(pd.notna(gap))
    print(json.dumps({"status": "passed", "rows": len(frame), "readiness_sample": readiness.tolist(), "skill_gap_sample": [round(float(value), 2) for value in gap]}, indent=2))

if __name__ == "__main__":
    main()
