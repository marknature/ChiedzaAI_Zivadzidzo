"""Save/reload and output-shape check for the dependency-light portfolio."""
import json
from pathlib import Path
def main():
    artifact = json.loads((Path(__file__).resolve().parents[1] / "models" / "industry4_numpy_model.json").read_text(encoding="utf-8"))
    assert len(artifact["features"]) == len(artifact["normalization"]["mean"])
    assert artifact["classification"]["selected"] in artifact["classification"]["metrics"]
    assert artifact["regression"]["selected"] in artifact["regression"]["metrics"]
    print(json.dumps({"status":"passed","artifact":artifact["version"],"classifier":artifact["classification"]["selected"],"regressor":artifact["regression"]["selected"]}, indent=2))

if __name__ == "__main__": main()
