"""Execute every committed notebook without Jupyter or heavyweight dependencies.

Outputs are written back into the notebook cells, making the R&D evidence reviewable in Git.
"""
import contextlib, io, json, traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NOTEBOOKS = [ROOT / "01_data_audit.ipynb", ROOT / "02_industry4_models.ipynb", ROOT / "03_exam_benchmark.ipynb", ROOT / "04_multitask_neural_network.ipynb", ROOT / "05_multimodel_fusion.ipynb", ROOT / "06_explainability.ipynb", ROOT / "07_sanity_check.ipynb"]

def execute(notebook_path):
    notebook = json.loads(notebook_path.read_text(encoding="utf-8")); namespace = {"__name__": "__notebook__", "__file__": str(notebook_path)}; count = 0
    for cell in notebook["cells"]:
        if cell.get("cell_type") != "code": continue
        count += 1; source = "".join(cell.get("source", [])); output = io.StringIO()
        try:
            with contextlib.redirect_stdout(output): exec(compile(source, str(notebook_path), "exec"), namespace)
            cell["execution_count"] = count; cell["outputs"] = [{"output_type":"stream", "name":"stdout", "text": output.getvalue().splitlines(keepends=True)}]
        except Exception:
            cell["execution_count"] = count; cell["outputs"] = [{"output_type":"error", "ename":"NotebookExecutionError", "evalue":"cell failed", "traceback": traceback.format_exc().splitlines()}]
            notebook_path.write_text(json.dumps(notebook, indent=1), encoding="utf-8"); raise
    notebook_path.write_text(json.dumps(notebook, indent=1), encoding="utf-8")
    print(f"PASSED {notebook_path.name}")

if __name__ == "__main__":
    for path in NOTEBOOKS: execute(path)
