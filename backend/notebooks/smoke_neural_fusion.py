"""Smoke check for the neural + fusion artifact."""
import json
from pathlib import Path
def main():
    artifact=json.loads((Path(__file__).resolve().parents[1]/"models"/"industry4_neural_fusion_model.json").read_text(encoding="utf-8"))
    assert artifact["classification"]["selected"] in artifact["classification"]["metrics"]
    assert artifact["regression"]["selected"] in artifact["regression"]["metrics"]
    assert artifact["classification"]["selected"] == max(artifact["classification"]["validation_metrics"], key=artifact["classification"]["validation_metrics"].get)
    assert artifact["regression"]["selected"] == min(artifact["regression"]["validation_metrics"], key=artifact["regression"]["validation_metrics"].get)
    assert len(artifact["classification"]["neural"]["w1"])==len(artifact["features"])
    assert abs(sum(artifact["classification"]["fusion_weights"].values())-1)<1e-6
    assert abs(sum(artifact["regression"]["fusion_weights"].values())-1)<1e-6
    print(json.dumps({"status":"passed","artifact":artifact["version"],"selected_classifier":artifact["classification"]["selected"],"selected_regressor":artifact["regression"]["selected"],"fusion_f1":artifact["classification"]["metrics"]["weighted_fusion"]["macro_f1"],"fusion_mae":artifact["regression"]["metrics"]["weighted_fusion"]["mae"]},indent=2))
if __name__=="__main__": main()
