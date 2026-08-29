# CareerForge AI — Career Readiness Platform

[![Design](https://img.shields.io/badge/Design-Bauhaus%20Neo--Brutalist-ffcc00?style=for-the-badge&logo=airplayvideo&logoColor=black)](https://github.com)
[![Stack](https://img.shields.io/badge/Stack-Next.js%2015%20%7C%20Node%20Express%20%7C%20MongoDB-0055ff?style=for-the-badge)](https://github.com)
[![Pipeline](https://img.shields.io/badge/AI%20Agents-6%20Cooperating%20Modules-e63b2e?style=for-the-badge)](https://github.com)

**CareerForge AI** is a full-stack AI Career Readiness Platform that takes a user's resume and turns it into an end-to-end job-readiness pipeline: **parse, tailor, score, prepare, and apply**.

Built strictly in accordance with [SPECS_resume_project.md](./SPECS_resume_project.md) (single source of truth) and styled with the **Bauhaus Neo-Brutalist** design system from `Design-v2`.

---

## ⚡ Key Capabilities

1. **Structured Resume Extraction**: Decodes PDF/DOCX/TXT files into structured schema (contact, experience, projects, skills, education, certifications).
2. **ATS Compatibility Scoring**: Heuristic and AI-driven ATS parser simulation analyzing section hierarchy, formatting, and keyword density.
3. **Role-Aware Resume Tailoring & Diff View**: Customizes resumes for target personas (`SDE`, `Fullstack`, `Backend`, `Frontend`, `Data/ML`, `DevOps`, `Product`, `Custom`) with side-by-side visual diffs and instant PDF export.
4. **JD-to-Resume Gap Analysis**: Compares a pasted job description against resume skills, outputting matched competencies (with line citations) and critical missing criteria.
5. **Interactive Mock Interviews & 4-Dimension Scorecard**: Role-specific technical & behavioral STAR questions, AI model answers, and evaluation across Clarity, Relevance, Structure, and Technical Depth.
6. **Curated Job Search Hub**: Dynamic deep-search URLs for LinkedIn, Internshala, Naukri, and Indeed powered by resume keywords (compliant with platform Terms of Service).
7. **Application Tracker & Analytics**: Kanban board (`Saved → Applied → OA → Interview → Offer / Rejected`) with conversion funnel yield and weekly application velocity charts.
8. **Real-Time Agentic Pipeline**: Live Socket.IO streaming timeline showing `Parser`, `Analyzer`, `Generator`, `Evaluator`, `Recovery`, and `Monitoring` agents at work.

---

## 🏗️ Architecture & Agentic Pipeline

```
                                  ┌──────────────────────────────┐
                                  │   Next.js (Pages Router)     │
                                  │   Tailwind Neo-Brutalist UI  │
                                  │     Zustand + Socket.IO      │
                                  └──────────────┬───────────────┘
                                                 │ HTTP / WebSockets
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │    Express API Gateway       │
                                  │    Routes → Controllers →    │
                                  │        Services Layer        │
                                  └──────┬───────────────┬───────┘
                                         │               │
                 ┌───────────────────────┴─┐           ┌─┴────────────────────────┐
                 ▼                         ▼           ▼                          ▼
       ┌───────────────────┐     ┌──────────────────┐┌───────────────────┐┌───────────────────┐
       │   Agent Pipeline  │     │ Background Queue ││  Database Layer   ││ Real-time Server │
       │ Parser / Analyzer │     │ BullMQ + Redis   ││  MongoDB Mongoose ││ Socket.IO Server │
       │ Generator / Eval  │     │ (InMemory fallbk)││ (InMemory fallbk) ││ Event Timeline   │
       │ Recovery / Monitor│     └──────────────────┘└───────────────────┘└───────────────────┘
       └─────────┬─────────┘
                 ▼
       ┌───────────────────┐
       │  Providers Layer  │
       │ OpenRouter API    │
       │ Gemini SDK        │
       │ Deterministic Rule│
       └───────────────────┘
```

---

## 🚀 Quick Start (Zero-Config Local Development)

CareerForge AI is architected to run out of the box with **zero required API keys or databases**. If MongoDB, Redis, Cloudinary, or AI keys are omitted, the platform automatically engages:
- **In-Memory MongoDB** (`mongodb-memory-server` fallback)
- **In-Memory Queue Dispatcher** (automatic BullMQ/Redis fallback)
- **Deterministic Rule & STAR Fallback Engine** (100% offline generation, parsing & evaluation)
- **Local File Uploads Storage**

---

### Step 1: Clone Repository & Open Workspace

```bash
git clone https://github.com/darekarbro/Agentic-AI-Automation.git
cd "Agentic-AI-Automation"
```

---

### Step 2: Set Up Backend Server

Open a terminal in the root workspace:

```bash
cd server
npm install
```

*(Optional)* Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Start the backend development server:

```bash
npm run dev
```

The server will start on: **`http://localhost:5000`**
Health check endpoint: **`http://localhost:5000/api/health`**

---

### Step 3: Set Up Frontend Client

Open a second terminal window:

```bash
cd client
npm install
```

*(Optional)* Create a `.env.local` file from the provided template:

```bash
cp .env.example .env.local
```

Start the Next.js development server:

```bash
npm run dev
```

The frontend web app will open at: **`http://localhost:3000`**

---

## ⚙️ Environment Configuration

### Backend (`server/.env`)

| Variable | Required? | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `5000` | Port for Express API server |
| `CLIENT_URL` | Optional | `http://localhost:3000` | Allowed CORS origin |
| `JWT_SECRET` | Optional | `careerforge-default-dev-secret` | Secret key for signing auth tokens |
| `MONGODB_URI` | Optional | `In-Memory Server` | MongoDB Atlas connection string |
| `OPENROUTER_API_KEY` | Optional | `""` | Primary AI provider key |
| `OPENROUTER_MODEL` | Optional | `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter model ID |
| `GEMINI_API_KEY` | Optional | `""` | Fallback AI provider key |
| `GEMINI_MODEL` | Optional | `gemini-1.5-flash` | Gemini model ID |
| `CLOUDINARY_CLOUD_NAME` | Optional | `""` | Cloudinary storage account name |
| `CLOUDINARY_API_KEY` | Optional | `""` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Optional | `""` | Cloudinary API Secret |
| `REDIS_URL` | Optional | `In-Memory Queue` | Redis URL for BullMQ queue worker |

### Frontend (`client/.env.local`)

| Variable | Required? | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Optional | `http://localhost:5000/api` | Base URL of backend REST API |
| `NEXT_PUBLIC_SOCKET_URL` | Optional | `http://localhost:5000` | Base URL for Socket.IO streaming |

---

## 🧭 Application Routes

### Frontend Pages
- `/` — Bauhaus Landing Page with platform overview & architecture highlights.
- `/login` & `/register` — Authentication with JWT session persistence.
- `/dashboard` — KPI console (Resumes, ATS Scores, Interview Readiness, App Pipeline).
- `/resume/upload` — Drag-and-drop file upload with live agent streaming timeline.
- `/resume/[id]` — Resume detail with structured JSON view, ATS score breakdown, versions.
- `/resume/[id]/tailor` — Role selector, JD paste box, side-by-side visual diff, PDF download.
- `/interview/setup` — Select role and resume for mock interview synthesis.
- `/interview/session/[id]` — Interactive Q&A lab with model answers and 4-dimension scorecards.
- `/interview/history` — Past interview logs, score progression charts, weak-topic heatmaps.
- `/jobs` — Job Search Hub with resume-derived deep links (LinkedIn, Internshala, Naukri, Indeed).
- `/applications` — Kanban tracker board with conversion rate funnel & weekly volume metrics.
- `/settings` — Candidate profile management & live AI provider health diagnostics.

---

## 📡 REST API Reference

### Health & Auth
- `GET  /api/health` — System heartbeat and AI provider availability status
- `POST /api/auth/register` — Register account (`name`, `email`, `password`, `targetRolePreference`)
- `POST /api/auth/login` — Authenticate and receive JWT token
- `GET  /api/auth/me` — Fetch current authenticated profile
- `PUT  /api/auth/me` — Update candidate profile & preferences

### Resumes & Tailoring
- `GET    /api/resumes/dashboard` — Aggregated KPI metrics for dashboard
- `GET    /api/resumes` — List user's uploaded resumes
- `POST   /api/resumes/upload` — Multipart upload (`file`, `title`) and start Parser Agent
- `GET    /api/resumes/:id` — Get resume structured data & ATS scores
- `DELETE /api/resumes/:id` — Delete resume and associated tailored versions
- `POST   /api/resumes/:id/tailor` — Generate role-tailored version (`targetRole`, `jobDescriptionText`)
- `GET    /api/resumes/:id/versions` — List tailored versions of a resume
- `GET    /api/resumes/:id/ats-score` — Fetch or recompute ATS breakdown score
- `POST   /api/resumes/:id/gap-analysis` — Compare against JD (`jobDescriptionText`, `targetRole`)
- `GET    /api/resumes/:id/download/:versionId` — Download tailored version as PDF

### Mock Interviews
- `POST /api/interview/sessions` — Start mock session (`resumeId`, `targetRole`, `count`)
- `GET  /api/interview/sessions` — List past interview sessions
- `GET  /api/interview/sessions/:id` — Fetch session with questions and submitted evaluations
- `POST /api/interview/sessions/:id/questions/:qid/answer` — Submit answer for 4-dimension scoring
- `GET  /api/interview/sessions/:id/questions/:qid/suggested-answer` — Reveal model answer
- `GET  /api/interview/analytics` — Score trend progression and weak-topic diagnostics

### Job Search & Applications
- `GET    /api/jobs/roles` — List supported job categories and default keywords
- `POST   /api/jobs/search-links` — Generate pre-filtered deep search links (`targetRole`, `resumeId`)
- `GET    /api/applications` — List tracked applications (`status`, `search`, `sort`)
- `POST   /api/applications` — Add application (`company`, `roleTitle`, `sourcePlatform`, `status`)
- `PUT    /api/applications/:id` — Update application status or notes
- `DELETE /api/applications/:id` — Remove application from tracker
- `GET    /api/applications/analytics` — Funnel stage conversions and weekly volume

### Jobs & Notifications
- `GET  /api/processing-jobs/:id` — Fetch background job state
- `GET  /api/processing-jobs/:id/timeline` — Fetch full agent event audit logs
- `POST /api/processing-jobs/:id/cancel` — Cancel running background job
- `GET  /api/processing-jobs/health/providers` — Check active AI provider status
- `GET  /api/notifications` — Fetch user activity notifications

---

## 🎨 Bauhaus Neo-Brutalist Design System

The frontend implements the Neo-Brutalist philosophy from `Design-v2`:
- **Palette**: Near-black (`#1a1a1a`), Accent Yellow (`#ffcc00`), Accent Blue (`#0055ff`), Accent Red (`#e63b2e`), Paper Canvas (`#f5f0e8`).
- **Borders & Elevation**: Hard 3px borders (`border-3 border-[#1a1a1a]`) and solid offset block shadows (`box-shadow: 5px 5px 0px #1a1a1a`). No soft blurred drop shadows.
- **Typography**: Geometric display typography with **Space Grotesk** and readable body font **Inter**.

---

## 🛡️ Security & Compliance

- **No Scraper Policy**: No automated scraping, bots, or OAuth against LinkedIn, Internshala, Naukri, or Indeed. Search queries are generated as pre-filtered public URLs opening directly in the browser.
- **Password Security**: Passwords hashed with bcrypt using cost factor 12.
- **API Security**: Request bodies validated with `express-validator`, headers secured with `helmet`, compression enabled, and rate-limiting enforced on auth endpoints.

---

## 📄 License

MIT © CareerForge AI Team
