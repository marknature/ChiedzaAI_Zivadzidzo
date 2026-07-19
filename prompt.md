# ZivaDzidzo product and AI contract

## Product purpose

ZivaDzidzo is an education-intelligence workspace for school leaders, teachers, and approved education stakeholders. It turns approved institution-level information into practical curriculum, staffing, learning-outcome, and school-readiness recommendations.

It is an **LLM decision-support product**. It does not train, serve, or represent a predictive machine-learning model, and it must not present generated advice as a guaranteed forecast or an automated decision.

## AI contract

- Every prediction or recommendation workflow must use the centrally selected, server-side LLM provider's structured-output capability. Responses must conform to the task schema before they are stored or shown.
- OpenAI is the default and primary provider, with pinned dated snapshots (`gpt-4o-2024-11-20` for predictions and `gpt-4o-mini-2024-07-18` for chat). An authorized backend operator may explicitly select Gemini or Anthropic for structured assessment heads and tool-enabled Assistant chat through `LLM_PROVIDER`; clients cannot select providers and there is no automatic cross-provider failover.
- Keep task identifiers and prompt-version tags in the central configuration registry. Persist the provider/model identifier and prompt version with each generated prediction.
- Tool-enabled chat normalizes the selected provider's function/tool-call format into ZivaDzidzo's server-side tool contract. Only the server executes a permitted tool and applies its existing input, privacy, and access checks before persisting the normalized audit record. Never silently remove a requested tool call, switch providers, or expose a service credential to a provider or client.
- Ground prompts in the requesting institution's approved context. If context is incomplete, state the uncertainty and request the missing institutional information rather than inventing facts.
- Present recommendations with confidence, assumptions, and human-review language. Do not make high-stakes learner, employment, disciplinary, admissions, or funding decisions.

## Data governance

- Do not collect, send to an LLM, store, or expose learner-level personally identifiable information. Use aggregate or institution-level data only.
- Enforce institution scoping and role-based access for all data and generated outputs. Privileged service credentials stay on the backend.
- Treat uploaded curriculum, staffing, outcome, and policy information as confidential school data. Use the minimum data needed for the requested workflow and follow agreed retention/deletion rules.
- Log model snapshot, prompt version, usage, and the minimum audit metadata needed to investigate a result without retaining unnecessary sensitive content.

## Product boundary

ZivaDzidzo supports professional judgement; it does not replace it. Every generated insight requires review by an authorized human before it informs school action.
