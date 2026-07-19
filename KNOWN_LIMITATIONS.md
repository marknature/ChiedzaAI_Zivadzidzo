# Known limitations

- No trained model in v1: every “prediction” is a GPT-4o structured-output completion against engineered features, not a model that learned from labelled outcomes.
- Explainability is self-reported by the LLM, not a mechanistic decomposition (unlike SHAP) — treat contributing_factors as plausibility-ranked, not additive/quantitative proof.
- Proxy/synthetic data only until a real pilot school data-sharing agreement exists.
- Determinism is best-effort (temperature=0, pinned model snapshot) not guaranteed.
- Student-level data is out of scope by design for v1, not an oversight.
- The Industry 4.0 model is trained on an external vocational benchmark, not Zimbabwean school data. Its strong held-out scores establish fit to that dataset only; it is an aggregate planning aid, not a locally validated forecast.
