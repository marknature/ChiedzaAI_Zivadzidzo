# Known limitations

- ZivaDzidzo provides LLM-assisted decision support, not deterministic forecasts, diagnoses, or automated personnel decisions. A qualified school leader must review every recommendation before acting on it.
- Structured-output explanations are plausibility-ranked reasoning from the supplied institutional context; they are not causal proof or a quantitative attribution model.
- Recommendations are only as reliable as the approved school, curriculum, staffing, and outcome data provided to the system. Seed and proxy data must not be treated as pilot evidence.
- Outputs may vary despite temperature controls and pinned model snapshots. Prompt versions and model snapshots are recorded so results can be traced and reviewed.
- Learner-level personal data and sensitive learner decisions are out of scope. The product is designed for institution-level planning and governance.
- Real-world deployment requires a school data-sharing agreement, role-based access controls, retention rules, and human review procedures appropriate to the institution.
