# ZivaDzidzo (by ChiedzaAI)

> **"Forecasting tomorrow's skills to modernize today's classrooms."**

ZivaDzidzo is an interactive educational intelligence platform designed to transition school administrations, teachers, and policy-makers from a reactive stance to a proactive shield. Built for the **OpenAI Build Week Challenge (Education Track)**, the application audits existing school syllabi against emerging technological trends, pinpointing curriculum skill gaps and simulating future student readiness using dynamic dashboards.

<br>

![Logo](https://github.com/marknature/Dzidzo-EduTech_Zivadzidzo/blob/main/logo1.png "Logo")

<br>

## 🚀 Key Features

1. **Curriculum Gap Auditor:** Upload standard curriculum PDF/TXT documents. GPT-5.6 parses the content, maps subjects against real-world automation indices, and outputs highly actionable modernization recommendations.
2. **"What-If" Skills Simulator:** An interactive simulation workspace allowing educators to adjust classroom parameter sliders (e.g., increasing digital literacy instruction time or project-based learning) to instantly view projected readiness outcomes.
3. **Teacher Upskilling Co-Pilot:** Actionable pathways translating high-level industry and AI trends into daily, manageable classroom instructional tasks.

<br>

## 🛠️ Technology Stack

ZivaDzidzo is engineered on a modular, enterprise-grade architecture:

*   **Frontend Mobile/Web:** Built with React Native, Expo, and styled via NativeWind for a highly responsive dashboard experience.
*   **Backend REST API:** Engineered with a Node.js and Express server hosting our core predictive orchestration endpoints.
*   **Database & Storage:** Leverages Supabase (PostgreSQL) to handle structured relational schemas, user historical audits, and global automation vectors.
*   **Intelligence Layer:** Powering deep semantic reasoning via the **OpenAI GPT-5.6 API** and utilizing **Codex** inside VS Code for rapid development.

<br>

## 📐 The Predictive Math Model

To calculate curriculum alignment, ZivaDzidzo computes a proprietary **Skills Obsolescence & Readiness Index ($R$)** directly on the client side for real-time simulation updates:

$$R = \sum_{i=1}^{n} w_i \cdot \left(1 - A_i\right) + \alpha \cdot F$$

Where:
* $w_i$ is the relative weight (importance) of subject $i$ within the current curriculum, satisfying $\sum w_i = 1$.
* $A_i \in [0, 1]$ represents the **Automation Vulnerability Factor** of subject $i$ calculated via GPT-5.6 based on current technology trends.
* $F \in [0, 1]$ represents the **Future Skills Integration Score** (presence of modern skills like critical thinking, AI collaboration, and system design).
* $\alpha$ is a scaling sensitivity coefficient representing regional digital infrastructure readiness.

<br>

## 💻 Installation & Setup

Ensure you have Node.js and the Expo CLI installed globally before proceeding.

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/ziva-dzidzo.git](https://github.com/your-username/ziva-dzidzo.git)
cd ziva-dzidzo

```

### Model R&D layer

The existing OpenAI/SRI audit remains the primary user workflow. An additive, privacy-bounded Industry 4.0 benchmark model lives under [`backend/notebooks/`](backend/notebooks/): it compares baseline and lightweight tabular models, exports a transparent JSON artifact, and is surfaced through `GET /models/industry4/status`.

```bash
cd backend/notebooks
python train_numpy_portfolio.py
python smoke_numpy.py
```

See [`backend/notebooks/MODEL_CARD.md`](backend/notebooks/MODEL_CARD.md) for measured results, data limitations, and the aggregate-only deployment boundary.

### 2. Set Up the Backend

Navigate to the server directory, install dependencies, and configure your environment variables.

```bash
cd backend
npm install

```

Create a `.env` file in the `backend` root:

```env
PORT=5000
OPENAI_API_KEY=your_gpt_5.6_and_codex_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_public_key

```

Start the local server:

```bash
npm run dev

```

### 3. Set Up the Frontend

Navigate to the frontend directory, install dependencies, and start the Expo bundle.

```bash
cd ../frontend
npm install
npx expo start

```

### Live audit workflow

The judge-facing flow is ready: **paste syllabus → AI audit → SRI → explainable modernization actions**.

1. Copy `backend/.env.example` to `backend/.env` and add `OPENAI_API_KEY`. The API operates in a deterministic demo mode without it, so the live experience still works reliably.
2. To persist history, run the SQL files in `backend/migrations/` (in order, `0000_...` then `0001_...`) in the Supabase SQL editor and add the Supabase credentials to `backend/.env`.
3. When using a physical phone, point the Expo app at the computer running the API, for example: `EXPO_PUBLIC_API_URL=http://192.168.1.5:5000 npx expo start`. The default targets the local machine.

`POST /api/audit/analyze` accepts `title`, `gradeLevel`, `syllabusText`, and optional `alpha`, returning the SRI, subject-level risk, rationale, and prioritized next actions.

### Full platform setup (institutions, auth, roster)

Beyond the standalone audit demo above, the app is growing into the full ZivaDzidzo platform (see the build plan for the phased roadmap). To bring up the full schema and sign-in flow:

1. Run **both** migration files in `backend/migrations/` against your Supabase project, in order.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env` (from your Supabase project's API settings — never commit this, never send it to the frontend).
3. Seed one institution, 3 departments, 5 subjects, and ~15 teachers: `cd backend && npm run seed`.
4. Copy `frontend/.env.example` to `frontend/.env` and set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the anon/public key only). Without these, the app skips the sign-in gate and only the Home (curriculum audit) tab is meaningfully usable.
5. Start the backend and run `npx expo start` in `frontend/` — sign up a user from the in-app Auth screen; the backend auto-provisions their profile onto the seeded institution via `POST /auth/session-sync`.

The app currently has 7 tabs: **Home** (curriculum audit, fully working), **Roster**, **My School**, **Chat**, **Reports**, **Cost**, and **Settings** (profile + sign out). Roster/My School/Chat/Reports/Cost are placeholders until their respective build phases land.

> **Note:** `nativewind@2` requires `tailwindcss@3.3.x`. A newer `tailwindcss` (3.4+) will break the Metro bundle at `App.js` with `Use process(css).then(cb) to work with async plugins` — `frontend/package.json` pins `tailwindcss` to `3.3.2` deliberately; don't bump it without re-testing a full bundle.

<br>

## 🧠 Codex & GPT-5.6 Acceleration (Judging Showcase)

A core requirement of our implementation was maximizing development velocity through agentic cooperation:

* **Scaffolding & SQL Migrations:** Codex accelerated our database layer by generating our entire Supabase PostgreSQL database schema, relational foreign keys, and initial table structures based on simple English descriptions of our requirements.
* **JSON Serialization & Parsing:** Running unstructured syllabi through GPT-5.6 requires highly reliable, predictable JSON formatting. Codex wrote the entire regex-based sanitation logic and Express middleware on the backend to parse model outputs cleanly under tight API deadlines.
* **Dynamic Component Styling:** Codex handled the layout mechanics of our NativeWind layout configurations, giving us the ability to build an aesthetically balanced, dashboard-driven user interface in record time.

<br>

## 👥 Sharing and Testing Credentials

The repository has been made accessible to the official hackathon testing accounts:

* **Shared with:** `testing@devpost.com` & `build-week-event@openai.com`
* **Codex Session ID for `/feedback` validation:** [Insert your active Codex Session ID here]
* **Demo Instance Credentials:** Use `admin@chiedza.ai` / `Chiedza2026!` on the login prompt to bypass fresh registration screens.
