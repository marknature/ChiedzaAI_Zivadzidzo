"""Research-only external exam-score benchmark; exports no production artifact."""
import csv, json
from pathlib import Path
import numpy as np

RAW = Path(__file__).resolve().parents[1] / "raw" / "StudentPerformanceFactors.csv"
FEATURES = ["Hours_Studied", "Attendance", "Previous_Scores", "Sleep_Hours", "Tutoring_Sessions", "Physical_Activity"]

def main():
    rows = list(csv.DictReader(RAW.open(encoding="utf-8")))
    X = np.array([[float(row[name]) for name in FEATURES] for row in rows], dtype=float)
    y = np.array([float(row["Exam_Score"]) for row in rows], dtype=float)
    rng = np.random.default_rng(42); ids = rng.permutation(len(X)); split = int(.8 * len(X)); train, test = ids[:split], ids[split:]
    mean, scale = X[train].mean(0), X[train].std(0); scale[scale == 0] = 1
    z_train, z_test = (X[train] - mean) / scale, (X[test] - mean) / scale
    design_train, design_test = np.c_[np.ones(len(train)), z_train], np.c_[np.ones(len(test)), z_test]
    baseline = np.full(len(test), y[train].mean()); linear = design_test @ (np.linalg.pinv(design_train) @ y[train]); ridge = design_test @ np.linalg.solve(design_train.T @ design_train + np.eye(design_train.shape[1]), design_train.T @ y[train])
    mae = lambda prediction: round(float(np.abs(prediction - y[test]).mean()), 4)
    print(json.dumps({"status":"research-only","rows":int(len(X)),"models":{"mean_baseline":{"mae":mae(baseline)},"linear_regression":{"mae":mae(linear)},"ridge_regression":{"mae":mae(ridge)}},"deployment":"No artifact exported; student-level data remains out of production."}, indent=2))

if __name__ == "__main__": main()
