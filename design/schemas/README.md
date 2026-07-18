# ZivaDzidzo prediction contracts

Each `{head}.schema.json` is a Draft 2020-12 contract for an OpenAI Structured Outputs response. Pass its full object as `response_format.json_schema.schema` with `strict: true`. The matching `{head}_examples.json` files are prompt few-shots and small regression seeds. A persisted `predictions` row should keep routing metadata (for example, `model_version`, `head`, and source cohort reference) in table columns and place the validated response unchanged in `predictions.prediction` (`jsonb`). It is intentionally not a one-to-one table schema.

- **teacher_roles** informs equitable, supportive professional-development prioritisation. It must not be used for appraisal, discipline, or staffing decisions.
- **learning_outcomes** helps a leader identify subject-and-grade cohorts needing curriculum or teaching support. It has no student identifier or name fields by design; individual student profiling is outside v1.
- **curriculum_skills** helps a leader sequence curriculum modernisation, balancing locally useful foundational knowledge with practical, emerging capabilities.

All heads use bands `low`, `moderate`, `high`, and `critical`. For teacher exposure, larger scores mean greater risk. For learning outcomes and curriculum relevance, larger scores mean healthier trajectory/relevance, so `low` indicates low risk. Every output carries the same caveat: it is LLM-reasoned and associational, not a trained causal prediction.
