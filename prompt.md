# ZivaDzidzo product and AI contract

## Product purpose

ZivaDzidzo is an education-intelligence workspace for school leaders, teachers, and approved education stakeholders. It turns approved institution-level information into practical curriculum, staffing, learning-outcome, and school-readiness recommendations.

It is an **LLM decision-support product**. It does not train, serve, or represent a predictive machine-learning model, and it must not present generated advice as a guaranteed forecast or an automated decision.

## AI contract

- Use OpenAI structured outputs for every prediction or recommendation workflow. Responses must conform to the task schema before they are stored or shown.
- Use only pinned, dated model snapshots configured centrally in `backend/config.js`. The prediction model is `gpt-4o-2024-11-20`; chat uses `gpt-4o-mini-2024-07-18`.
- Keep task identifiers and prompt-version tags in the central configuration registry. Persist the model snapshot and prompt version with each generated prediction.
- Ground prompts in the requesting institution's approved context. If context is incomplete, state the uncertainty and request the missing institutional information rather than inventing facts.
- Present recommendations with confidence, assumptions, and human-review language. Do not make high-stakes learner, employment, disciplinary, admissions, or funding decisions.

## Data governance

- Do not collect, send to an LLM, store, or expose learner-level personally identifiable information. Use aggregate or institution-level data only.
- Enforce institution scoping and role-based access for all data and generated outputs. Privileged service credentials stay on the backend.
- Treat uploaded curriculum, staffing, outcome, and policy information as confidential school data. Use the minimum data needed for the requested workflow and follow agreed retention/deletion rules.
- Log model snapshot, prompt version, usage, and the minimum audit metadata needed to investigate a result without retaining unnecessary sensitive content.

## Product boundary

ZivaDzidzo supports professional judgement; it does not replace it. Every generated insight requires review by an authorized human before it informs school action.
