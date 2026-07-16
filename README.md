# ZivaDzidzo (by ChiedzaAI)

> **"Forecasting tomorrow's skills to modernize today's classrooms."**

ZivaDzidzo is an interactive educational intelligence platform designed to transition school administrations, teachers, and policy-makers from a reactive stance to a proactive shield. Built for the **OpenAI Build Week Challenge (Education Track)**, the application audits existing school syllabi against emerging technological trends, pinpointing curriculum skill gaps and simulating future student readiness using dynamic dashboards.

<br>

![Logo](https://www.example.com/logo.png "Logo")

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
