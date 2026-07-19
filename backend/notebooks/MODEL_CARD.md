# Industry 4.0 aggregate readiness model card

## Purpose

This model supports **aggregate curriculum and skill-planning discussion**. It classifies a cohort-style feature profile into an external Industry 4.0 readiness category and estimates a skill-gap score. It is one input to ZivaDzidzo alongside the OpenAI curriculum audit and SRI—not a replacement for either.

## Training data and boundary

The model trains on `backend/raw/industry4_vocational_skill_mapping_dataset.csv` (15,000 records). That dataset is an external vocational-learning benchmark; it is not Zimbabwean school data and it must not be presented as such. Inputs to `/models/industry4/predict` are aggregate cohort averages only. No individual learner identifier, teacher identifier, or student-level decision is accepted or stored.

## Experiment result

`industry4_numpy_v1` uses a deterministic 80/20 split with seed 42. The readiness portfolio compared majority baseline, nearest-centroid, and multiclass softmax regression. Nearest-centroid was selected on held-out macro-F1: **0.9963**, compared with **0.0656** for the majority baseline. The skill-gap portfolio compared mean baseline, ordinary linear regression, and ridge regression. Linear regression was selected on MAE: **0.6834**, compared with **16.9462** for the mean baseline.

The unusually high readiness score may reflect a synthetic or strongly separable source dataset. It is evidence of fit to this benchmark—not evidence of real-world validity. A pilot with consented, aggregate Zimbabwean school data and drift testing is required before any operational claim.

## Reproduce

Use the bundled workspace Python runtime or an environment with NumPy:

```powershell
cd backend/notebooks
python train_numpy_portfolio.py
python smoke_numpy.py
```

The output is `backend/models/industry4_numpy_model.json`; the Node API reads this artifact directly. Re-run training whenever a raw source changes and commit the updated artifact, metrics, and model-card text together.
