You are my senior full-stack engineer building ZivaDzidzo — the education intelligence
module of the ChiedzaAI platform — from scratch, in this repository. Read this entire
brief before writing any code. Treat it as the persistent spec: refer back to it across
sessions rather than re-deriving decisions.

## What ZivaDzidzo is

ZivaDzidzo forecasts how AI and digital transformation affect learning outcomes, teacher
roles, student performance, curriculum needs, and future skills — for schools in Zimbabwe,
starting with one pilot institution. It is the sibling module to ZivaBasa (a workforce
intelligence tool for banks, already built on a heavier Python/TensorFlow/SHAP stack).
ZivaDzidzo deliberately uses a lighter, mobile-first stack and an LLM as the reasoning
engine instead of a trained model, because there is no labelled training data yet. Do not
build a TensorFlow/scikit-learn pipeline. Do not add Python to this repo. Everything is
JavaScript/TypeScript.

## Non-negotiable architecture

Mobile Frontend    -> Backend Core       -> Intelligence Layer   -> Data Cloud
React Native+Expo  -> Node.js+Express    -> OpenAI GPT-4o        -> Supabase
(NativeWind v2)       (JavaScript/TS)       (structured outputs)    (PostgreSQL + RLS)

- Monorepo with two apps: `apps/mobile` (Expo) and `apps/api` (Express). Use npm workspaces
  (or pnpm workspaces if already configured) with a shared `packages/shared` for TypeScript
  types, Zod schemas, and constants that both apps import — this is the single source of
  truth pattern; do not duplicate a schema definition in both apps.
- TypeScript everywhere. Strict mode on. No `any` without a `// eslint-disable` comment
  explaining why.
- Supabase for auth, Postgres, storage, and RLS. Mobile client uses the anon key + RLS.
  The Express backend uses the anon key for user-scoped operations and the service role
  key ONLY for privileged operations (report generation writing to Storage). Never ship
  the service role key to the mobile client or commit it anywhere.
- OpenAI Node SDK, model `gpt-4o` (pinned to a dated snapshot string, not the floating
  alias) for the three predict task heads, `gpt-4o-mini` for chat. Use `response_format`
  with a strict JSON Schema (not loose `json_object` mode) for every predict call.

## Build order — work through these phases in sequence, do not skip ahead

### Phase 0 — Foundations
1. Scaffold the monorepo: `apps/mobile` (Expo, TypeScript template, NativeWind v2, React
   Navigation), `apps/api` (Express, TypeScript, ts-node-dev for local dev), `packages/shared`.
2. Set up ESLint + Prettier shared config at the root, applied to both apps.
3. Create the Supabase schema exactly as specified below (Section: Database Schema). Write
   it as a versioned SQL migration file under `apps/api/db/migrations/`, not a one-off script
   — use `supabase migration new` conventions even if you're not running the Supabase CLI
   yet, so the migration history is real from commit one.
4. Enable RLS on every table before writing a single API route that touches them. Write the
   policies in the same migration file as the table, not a separate "security pass" later.
5. Seed script (`apps/api/db/seed.ts`) that inserts one institution, ~15 synthetic teachers
   across 5 subjects, and 3 departments — realistic enough to demo against immediately.
6. `apps/api/src/config.ts` — single source of truth for: task_type enum values, model
   snapshot strings, prompt version tags, Supabase table names, rate limit thresholds. Every
   other file imports from here. Do not hardcode a model name or table name anywhere else.
7. Auth: Supabase email/password + magic link, wired end-to-end in the mobile app (login
   screen -> session persisted -> profile row upserted). Single institution, so skip an
   institution-picker screen for now, but do NOT skip the profiles.institution_id foreign
   key or the RLS policies that depend on it — the schema stays multi-tenant-ready even
   though the UI doesn't expose it yet.

Stop after Phase 0 and show me: the repo tree, the migration file, and a screenshot/description
of the working login flow, before moving to Phase 1.

### Phase 1 — Core predict loop (build ONE task head fully, end to end, before touching the other two)
Build the Teacher Roles head completely — roster screen, engineered features, prompt schema,
API route, persistence, UI rendering of the result including the rationale and caveats —
before starting on Learning Outcomes or Curriculum Skills. This is deliberate: get one
vertical slice fully correct and reviewed, then replicate the pattern, rather than building
three shallow half-finished heads in parallel.

1. `packages/shared/schemas/teacherRoles.ts` — the JSON Schema for the structured output
   (see Section: Structured Output Schemas below for the exact shape).
2. `apps/api/src/services/openaiService.ts` — wraps the OpenAI client, takes a schema + system
   prompt + feature payload, returns parsed+validated JSON (validate the response against the
   Zod-mirrored schema before trusting it, even though `strict: true` mode should guarantee
   shape — LLM APIs can still fail or timeout, code the failure path).
3. `apps/api/src/services/supabaseService.ts` — thin wrapper around the Supabase JS client,
   one function per table operation, not a generic query builder scattered through routes.
4. `apps/api/src/routes/teachers.ts` — CRUD for the roster.
5. `apps/api/src/routes/predict.ts` — `POST /predict/teacher-roles` route: load teacher raw
   features from Supabase -> compute engineered features server-side (see formulas below) ->
   call openaiService -> persist to `predictions` table -> return the full row.
6. `apps/mobile/src/screens/RosterScreen.tsx` — list of teachers (FlashList, not FlatList, for
   perf), tap a teacher to trigger a prediction, render exposure_band as a coloured chip,
   contributing_factors as a weight-sorted horizontal bar list, and the `caveats` string
   ALWAYS visible below the result, not hidden in a modal or tooltip. This caveats field is
   a product requirement, not a nice-to-have — do not let it get styled into invisibility.
7. Write a prompt regression test (`apps/api/tests/predictTeacherRoles.test.ts`): 10-15
   synthetic teacher profiles with an EXPECTED RANGE (not exact value) for
   ai_disruption_exposure_score and exposure_band, run against the live API route in CI.
   LLM output isn't deterministic enough for exact-match assertions — assert ranges and
   schema validity, not exact numbers.

Stop after Phase 1 and show me the working roster -> predict -> result flow before continuing.

### Phase 2 — Remaining task heads + chat
Repeat the Phase 1 pattern for:
- Learning Outcomes head (`/predict/learning-outcomes`) — cohort/subject-level only, see the
  "Student data" rule below, this head NEVER takes individual student identifiers as input.
- Curriculum & Future Skills head (`/predict/curriculum-skills`)

Then build the chat interface:
- `gpt-4o-mini`, OpenAI function-calling with tools: `run_teacher_prediction`,
  `run_learning_outcome_prediction`, `run_curriculum_prediction`, `fetch_roster`,
  `fetch_predictions_history`. Every tool call and its result gets persisted to
  `chat_messages.tool_calls` as JSON — this is what makes the chat auditable later, don't
  skip persisting tool call payloads just because the UI only shows the text response.
- `apps/mobile/src/screens/ChatScreen.tsx` with streaming responses if the OpenAI SDK
  streaming path is reasonably simple to wire in React Native; otherwise a clean
  loading-state-then-full-response is an acceptable fallback — don't burn a day fighting
  RN streaming ergonomics if it's not working smoothly, ask me first.

### Phase 3 — MySchool, roster import, reports, notifications
1. `MySchoolScreen.tsx` — departments/subjects as a simple accordion/tree (not a canvas-based
   org-chart renderer — that's a poor mobile fit, keep it list-based).
2. `UploadScreen.tsx` + `POST /schools/:id/import` — CSV/XLSX roster/structure import using
   `expo-document-picker` client-side and `csv-parse`/`xlsx` server-side. Validate every row
   against the shared Zod schema before insert; return a per-row error report for anything
   that fails validation rather than silently dropping bad rows.
3. Report generation: `apps/api/src/services/reportService.ts` using the `docx` npm package
   to build a Word document (a prediction + its rationale + an embedded chart image
   rendered server-side via `chartjs-node-canvas`), uploaded to Supabase Storage under
   `reports/{institution_id}/`, with a `reports` row and a short-lived signed URL returned
   to the client. Build BOTH a "predict report" (single prediction) and a "chat report"
   (cleaned transcript + any predictions run as chat tools) — scope PDF export alongside
   Word from the start (render the same docx through a PDF conversion step) rather than
   letting it slip to "later" the way the ZivaBasa sibling project's Word-only export did.
4. Push notifications (`expo-notifications`) firing when a prediction lands in the
   `critical` or `urgent` band — this is a mobile-native feature the web sibling doesn't
   have, worth getting right.

### Phase 4 — Hardening
1. Security pass: `helmet()`, per-IP and per-user rate limiting on every route, audit that
   every table's RLS policy actually blocks cross-institution access (write a test that
   tries and asserts it fails, don't just eyeball the SQL).
2. Full prompt regression suite run, checked into a CI workflow (GitHub Actions is fine)
   that runs on every PR touching `packages/shared/schemas/` or `apps/api/src/services/openaiService.ts`.
3. Write `KNOWN_LIMITATIONS.md` at the repo root (content below) and link it from the app's
   Settings screen — this ships to users, not just internal docs.

## Database schema

Build exactly this, adjust only if you hit a concrete Supabase constraint I haven't
accounted for (tell me if so, don't silently redesign it):

institutions(id, name, district, school_type, created_at)
profiles(id -> auth.users, institution_id, full_name, role[admin|head_teacher|teacher|ministry_viewer], created_at)
departments(id, institution_id, name)
subjects(id, department_id, name, grade_level)
teachers(id, institution_id, full_name, subject_id, years_experience, ai_tool_usage_frequency,
         digital_skills_score, training_hours, last_assessed_at)
predictions(id, institution_id, task_type[learning_outcomes|teacher_roles|curriculum_skills],
            target_ref_id, input_features jsonb, prediction jsonb, rationale jsonb,
            confidence numeric, model_version text, created_by, created_at)
chat_sessions(id, institution_id, created_by, title, created_at)
chat_messages(id, session_id, role[user|assistant|tool], content, tool_calls jsonb, created_at)
reports(id, institution_id, report_type[predict_report|chat_report], storage_path,
        created_by, created_at)

RLS: every table filters on `institution_id = (select institution_id from profiles where id = auth.uid())`.
predictions writes are role-gated to admin/head_teacher only. Add a `ministry_aggregate_view`
that exposes only aggregated counts/averages per institution/task_type/month, never raw rows
— this is the only thing a `ministry_viewer` role can read.

## Structured output schema shape (use this pattern for all three heads, adjust fields per head)

Every predict head's JSON Schema must include, at minimum:
- a numeric score (0-100) and a categorical band derived from it
- a `contributing_factors` array: {factor, direction[increases_risk|decreases_risk],
  relative_weight (0-1), evidence (string)}
- `recommended_actions`: string array
- `confidence`: 0-1
- `caveats`: string — MUST explicitly state this is LLM-reasoned, not a trained model's
  output, and is associational, not causal. Do not write a generic disclaimer here, write
  one specific to what was just predicted.

Set `temperature: 0` on every predict call. Use `response_format: { type: "json_schema",
json_schema: { strict: true, ... } }`, not loose `json_object` mode.

## Engineered features (compute server-side before every predict call, never trust the client to send these)

training_hours_per_year_of_service = training_hours / max(years_experience, 1)
digital_readiness_index = 0.5*digital_skills_score + 0.3*(usage_frequency_numeric*20)
                           + 0.2*min(training_hours/40, 1)*100
  where usage_frequency_numeric maps never=0, rarely=1, sometimes=2, often=3, daily=4

## Rules that override convenience

- Student-level data: v1 NEVER accepts or stores individually-identifiable student records.
  The Learning Outcomes head takes cohort/subject-level aggregate inputs only (e.g. pass
  rate by subject+grade), never a named student. If a future ticket asks you to add
  individual student tracking, stop and ask me first — this is a deliberate scope boundary,
  not an oversight, because minors' data is involved.
- Every `predictions.model_version` value must encode both the pinned OpenAI model snapshot
  string AND a prompt template version tag (e.g. "gpt-4o-2026-08-06::teacher_roles_v1").
  Bump the version tag any time you change a system prompt, schema, or few-shot example —
  treat this with the same discipline as a package version bump.
- Never hardcode the Supabase service role key or the OpenAI API key anywhere in
  `apps/mobile` — mobile calls always go through `apps/api`, never directly to OpenAI or to
  Supabase with elevated privileges.
- Don't build a Python microservice, don't add TensorFlow/scikit-learn/SHAP to this repo.
  If a future need for a genuinely trained model comes up, that's a new architectural
  decision to raise with me explicitly, not something to fold in quietly.

## What to show me at the end of each phase

A short summary of what was built, the file tree diff, and — for anything touching the
predict flow — the actual JSON output of one real (or mocked, if no OPENAI_API_KEY is set
yet) prediction call, so I can sanity-check the schema and caveats text before you move on.

## KNOWN_LIMITATIONS.md content (create this file verbatim, then extend it as the build progresses)

- No trained model in v1: every "prediction" is a GPT-4o structured-output completion
  against engineered features, not a model that learned from labelled outcomes.
- Explainability is self-reported by the LLM, not a mechanistic decomposition (unlike SHAP)
  — treat contributing_factors as plausibility-ranked, not additive/quantitative proof.
- Proxy/synthetic data only until a real pilot school data-sharing agreement exists.
- Determinism is best-effort (temperature=0, pinned model snapshot) not guaranteed.
- Student-level data is out of scope by design for v1, not an oversight.

Start with Phase 0. Ask me anything you need before starting if something above is
ambiguous — don't guess silently on the schema, the auth model, or the RLS policies,
those are the three places a wrong guess is expensive to unwind later.
