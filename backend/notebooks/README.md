# ZivaDzidzo model R&D notebooks

This directory is the experimentation layer. It trains only against files in `../raw/`, writes versioned artifacts to `../models/`, and never connects directly to the production database.

| Notebook/script | Purpose | Production status |
| --- | --- | --- |
| `01_data_audit.ipynb` | Inspect schema, missingness, target balance, and privacy suitability | Required before every new dataset |
| `02_industry4_models.ipynb` | Compare skill-readiness classification and skill-gap regression models | Candidate model source |
| `03_exam_benchmark.ipynb` | Compare exam-score regressors on an external benchmark dataset | Research only; never student-level API input |
| `04_multitask_neural_network.ipynb` | Train a shared-trunk, two-head NumPy neural network | Candidate model source |
| `05_multimodel_fusion.ipynb` | Inspect validation-weighted per-target model fusion | R&D only unless it wins held-out metrics |
| `06_explainability.ipynb` | Verify transparent feature-deviation signals | Matches API explanations |
| `07_sanity_check.ipynb` | Validate neural/fusion artifact integrity | CI-ready |
| `train_numpy_portfolio.py` | Reproducible, dependency-light artifact export used by notebook 02 | Candidate model exporter |
| `smoke_numpy.py` | Fast save/reload and prediction-shape test | CI-ready |

Run from `backend/notebooks` after installing `requirements.txt`:

```powershell
python train_numpy_portfolio.py
python smoke_numpy.py
python run_all_notebooks.py
jupyter lab
```

The supplied `dataset-focus-5.csv` is a catalog of possible datasets, not training data. It remains in `../raw/` as provenance. ZivaDzidzo may deploy only the aggregate Industry 4.0 readiness model; individual learner or student records must stay out of the production API.
