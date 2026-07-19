# ZivaDzidzo — education intelligence for school leaders

ZivaDzidzo turns approved school-level context into practical curriculum, staff-readiness, and cohort-outcomes decision support for the OpenAI Build Week Education track.

It is intentionally **LLM-native**: OpenAI Structured Outputs are the default production route, with a checked JSON schema and pinned OpenAI snapshots. A backend operator may explicitly select Gemini or Anthropic for the three structured assessment heads and tool-enabled Assistant; every provider response is still validated by the same server-side JSON/Zod contracts. It does not train, serve, or claim a predictive machine-learning model.

## What is built

- A responsive Expo mobile/web workspace with five primary destinations: Dashboard, My School, Assess, Reports, and More.
- An aggregate-only school-leader dashboard with readiness coverage, priority alerts, curriculum status, learning-outcomes trends, and recent activity.
- Three structured assessment heads:
  - Teacher Roles — AI-disruption exposure and reskilling priority from staff readiness signals.
  - Learning Outcomes — cohort/subject-level pass-rate resilience; learner identifiers are rejected before any model call or persistence.
  - Curriculum & Future Skills — a Skills Obsolescence & Readiness Index (SRI), with the final score independently calculated on the backend.
- Department and subject hierarchy, guided roster-import preview, confirmation, validation feedback, and an atomic database import function.
- Private DOCX/PDF reports with executive summary, evidence, chart, timestamp, model/prompt version, actions, and caveat.
- Role-filtered priority notifications that deep-link to the aggregate Dashboard.

## Trust and data boundaries

- OpenAI remains the default/primary provider, configured in [`backend/config.js`](backend/config.js) with pinned dated snapshots: `gpt-4o-2024-11-20` for structured assessment and `gpt-4o-mini-2024-07-18` for chat. Gemini and Anthropic are optional, backend-only providers for structured assessments and tool-enabled Assistant chat, selected by `LLM_PROVIDER`; there is no silent failover.
- Scores, confidence, caveats, and contributing factors are LLM-reasoned decision support—not causal proof, a trained model, or an automated decision.
- ZivaDzidzo never accepts, stores, sends to an LLM provider, or displays learner-level identifiers. Learning Outcomes accepts cohort aggregates only.
- Supabase RLS scopes data to an institution. Profile roles and institution membership cannot be self-assigned through the client.
- Service-role credentials are backend-only. Never place them in `frontend/.env`.

See [`prompt.md`](prompt.md) for the canonical product/AI contract and [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) for the current limitations.

## Architecture

```text
Expo / React Native + NativeWind
          │ bearer token
          ▼
Express API ── server-selected LLM provider
   │              ├─ OpenAI (default, pinned snapshots)
   │              ├─ Gemini (optional, structured assessments + tools)
   │              └─ Anthropic (optional, structured assessments + tools)
   │       └─ independent SRI calculation
   ▼
Supabase Auth + Postgres + RLS + private report Storage
```

## Local setup

### 1. Install dependencies

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

### 2. Configure the backend

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and set:

```env
OPENAI_API_KEY=your_backend_only_key
LLM_PROVIDER=openai
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_backend_only_service_role_key
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

The backend fails closed if the selected provider's key is absent: it does not generate heuristic, mock, offline, or trained-model replacements.

### 2a. Optional full-product providers

OpenAI is the default and is the recommended Build Week configuration. To deliberately use a different provider for all three structured assessment heads, the legacy curriculum-audit compatibility route, and the tool-enabled Assistant, set **one** server-side provider and its key in `backend/.env`:

```env
# Gemini structured assessments
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_backend_only_gemini_key
GEMINI_PREDICT_MODEL=gemini-2.5-flash
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

```env
# Anthropic structured assessments
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_backend_only_anthropic_key
ANTHROPIC_PREDICT_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_CHAT_MODEL=claude-haiku-4-5-20251001
```

Provider selection is made only on the backend, is captured with the model/prompt version in prediction and chat metadata, and never falls back automatically. The Assistant normalizes each provider's tool-call format before it executes a permitted server-side tool, so selecting Gemini or Anthropic does not silently drop tool use. Do not place any provider key in `frontend/.env`, an `EXPO_PUBLIC_*` variable, source control, or a chat transcript. Gemini and Anthropic return provider-reported token usage where available, but ZivaDzidzo intentionally does not invent a dollar estimate for them.

`GEMINI_CHAT_MODEL` and `ANTHROPIC_CHAT_MODEL` default to their provider's low-latency assessment defaults but can be changed independently. A consumer/free chat plan is not an API credential: availability, quotas, and billing are determined by the provider's API account and region, not by ZivaDzidzo. If the selected provider key is absent or the provider rejects a request, the relevant request fails closed; it never routes to another provider.

### 3. Apply database migrations

Run every file in [`backend/migrations`](backend/migrations) in numeric order in the Supabase SQL editor:

```text
0000_initial_audits.sql
0001_core_platform.sql
0002_phase3_phase4.sql
0003_hardening_rls_storage.sql
0004_audits_tenant_scope.sql
0005_security_membership_and_chat.sql
0006_atomic_roster_import.sql
0007_report_access_hardening.sql
```

Then seed a synthetic demo institution:

```powershell
cd backend
npm run seed
```

New accounts remain in **Institution access pending** until an authorized administrator assigns a profile. For a local demo, create the profile through the Supabase SQL editor or a trusted server-side workflow—never from the mobile client:

```sql
insert into public.profiles (id, institution_id, full_name, role)
values ('AUTH_USER_UUID', 'INSTITUTION_UUID', 'Demo Admin', 'admin');
```

### 4. Configure and start the Expo app

Copy `frontend/.env.example` to `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:5000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Start both services:

```powershell
cd backend
npm run dev

cd ..\frontend
npx expo start --web
```

For a physical device, set `EXPO_PUBLIC_API_URL` to the LAN address of the machine running the API and add that web origin to `CORS_ALLOWED_ORIGINS` for browser development.

## Verification

```powershell
cd backend
npm test -- --runInBand

cd ..\frontend
npx expo export --platform web
```

The repository test suite covers structured schemas, formula boundaries, aggregate-only learner input, privacy rejection, school-dashboard aggregation/privacy, reports, roster parsing, notifications, and the LLM-only audit path.

## Demo flow

1. Sign in as an institution administrator or head teacher.
2. Open **Assess** and run a Curriculum & Future Skills assessment with a real syllabus.
3. Run a Learning Outcomes assessment with subject/grade cohort aggregates only.
4. Open **Dashboard** to show aggregate readiness, priority alerts, trends, and caveats.
5. Use **My School** to preview and confirm a safe roster import.
6. Export a DOCX or PDF report from **Reports**.

## Build-week framing

The memorable workflow is simple: **approved school context → strict structured AI analysis → independently calculated readiness → explainable leader actions → private executive report**.
