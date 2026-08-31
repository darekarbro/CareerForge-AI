# CareerForge AI — Complete Specification

## 1. Project Overview

**Project Name:** CareerForge AI

**One-line description:** A full-stack AI Career Readiness Platform that takes a user's resume and turns it into a complete job-readiness pipeline — parse, tailor, score, prepare, and apply.

**Detailed description:**
CareerForge AI lets a user upload a resume and, from that single artifact, run an entire job-search preparation pipeline:

- Extract structured data from the resume (contact info, skills, experience, education, projects, certifications)
- Generate AI-tailored resume versions for multiple target roles (SDE, Fullstack, Backend, Frontend, Data/ML, DevOps, Product, or a custom role)
- Score every resume version for ATS (Applicant Tracking System) compatibility
- Run gap analysis between a resume and a specific job description (JD)
- Generate role-aware, resume-aware interview questions with AI-suggested model answers
- Run live mock-interview sessions where the user answers questions and receives structured, dimension-based AI feedback
- Browse a role-categorized Job Search Hub with deep links to live search results on LinkedIn, Internshala, Naukri, and Indeed
- Track every job application manually in a status-pipeline board, with analytics

Every AI-driven action (parsing, tailoring, scoring, question generation, answer evaluation) runs through a chain of cooperating backend "agents," is queued as a background job, streams live progress to the browser over WebSockets, and is fully logged for auditing.

**Design principle:** No automation, OAuth, or scraping is performed against LinkedIn, Internshala, Naukri, or Indeed. The Job Search Hub only *generates and displays* deep-linked public search URLs. This is a deliberate choice to avoid violating those platforms' Terms of Service (which prohibit bots and automated account actions) and to keep the feature reliable and demoable.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | Next.js (Pages Router), React 19 |
| **Styling** | Tailwind CSS |
| **State management** | Zustand |
| **HTTP client** | Axios |
| **Real-time client** | Socket.IO client |
| **File upload UI** | react-dropzone |
| **Charts** | recharts (score trends, funnel analytics) |
| **Icons** | lucide-react |
| **Backend runtime** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **Auth** | JSON Web Tokens (JWT) + bcryptjs + Firebase Google Sign-In (frontend Firebase Web SDK + backend firebase-admin verification) |
| **Background jobs** | BullMQ on Redis (via ioredis), with in-memory fallback |
| **Real-time server** | Socket.IO |
| **Security middleware** | helmet, CORS, express-rate-limit |
| **Logging** | morgan |
| **Compression** | compression |
| **Validation** | express-validator |
| **File handling** | multer (upload), pdf-parse + mammoth (text extraction from PDF/DOCX) |
| **AI providers** | OpenRouter API (primary), Google Generative AI SDK / Gemini (fallback), deterministic rule-based processor (final fallback) |
| **File storage** | Cloudinary (resume PDFs/DOCX, and any generated PDF exports) |
| **Frontend hosting** | Vercel |
| **Backend hosting** | Render |
| **Database hosting** | MongoDB Atlas (free M0 tier) |

**Explicitly out of scope:** OAuth integrations with LinkedIn/Internshala/Naukri/Indeed, browser automation, scraping, and any form of auto-apply. See Section 16 — Security Requirements for the hard rule.

---

## 3. Core Feature Set

### 3.1 Authentication
- User registration and login
- JWT-based session handling for the app shell after sign-in
- Firebase Google Sign-In on the frontend using the Firebase Web SDK
- Backend verification of Firebase ID tokens via firebase-admin before issuing the app JWT
- Protected routes (frontend and backend)
- `GET /api/auth/me` profile endpoint
- Role separation: `admin` | `user`
- Password hashing with bcrypt, cost factor 12
- Google sign-ins create or link the Mongo user record and continue through the normal app JWT flow
- Persistent login state on the client via Zustand

### 3.2 Resume Management
- Upload a resume file (PDF or DOCX)
- AI/parsing pipeline extracts structured data: contact info, skills, work experience, education, projects, certifications
- Maintain multiple base resumes per user
- Generate role-tailored versions of any resume for a target role:
  - SDE
  - Fullstack
  - Backend
  - Frontend
  - Data / ML
  - DevOps
  - Product
  - Custom role (free text)
- Optionally tailor against a specific pasted/uploaded job description instead of just a role name
- View a side-by-side **diff** between the original resume and any tailored version (added / removed / changed content clearly highlighted)
- Download any tailored version as a PDF
- Full version history per resume

### 3.3 ATS Scoring
- Independent of any specific JD: evaluates section structure, keyword density, formatting compatibility (tables/columns/graphics that break ATS parsers), and length
- Returns a numeric score plus a breakdown of *why* the score is what it is
- Recomputed automatically whenever a new tailored version is generated

### 3.4 JD-to-Resume Gap Analysis
- User pastes or uploads a job description
- System returns:
  - An overall match score
  - Must-have skills the resume is missing
  - Nice-to-have skills the resume is missing
  - Matched skills, each linked to the specific resume line/bullet that supports the match (traceability, not just a generic score)

### 3.5 Interview Preparation
- Start a session by selecting: target role, resume version, and (optionally) a specific JD
- AI generates a mixed set of questions:
  - Technical
  - Behavioral
  - Role-specific
- Each question has a difficulty tag
- User can reveal an AI-suggested model answer at any time
- User can submit their own written answer and receive structured feedback across four dimensions:
  1. Clarity
  2. Relevance
  3. Structure / STAR-method adherence (for behavioral questions)
  4. Technical correctness (for technical questions)
- Full session history is retained
- Score trend chart across all past sessions
- "Weak topic" heatmap aggregated across all sessions (e.g., consistently low scores on system-design questions)

### 3.6 Job Search Hub
- Role-categorized dashboard: one card per role (SDE, Fullstack, Backend, Frontend, Data, etc.)
- Each card contains:
  - AI-generated search keywords, derived from the user's resume skills + selected role (not generic keywords)
  - Deep-link buttons to pre-filtered public search-results pages on:
    - LinkedIn Jobs
    - Internshala
    - Naukri
    - Indeed
- No login, OAuth, or scraping involved — links open the platform's own search UI in a new tab

### 3.7 Application Tracker
- Manually add a tracked application: company, role title, source platform, job link, applied date
- Status pipeline: `Saved → Applied → OA → Interview → Offer / Rejected`
- Notes per application
- Edit / delete tracked applications
- Analytics: applications per week, funnel conversion rate between stages

---

## 4. Agentic Processing Pipeline

Every resume, JD, and interview action runs through a fixed chain of backend service "agents." The workload is linear (not dynamically planned), so this is implemented as an orchestrated sequence of service modules rather than a full agent-planning framework.

| Agent | Responsibility |
|---|---|
| **Parser Agent** | Extracts raw text from the uploaded file and converts it into structured resume JSON |
| **Analyzer Agent** | Runs JD-to-resume gap analysis and computes the ATS formatting score |
| **Generator Agent** | Produces the role-tailored resume rewrite, the interview question set, and suggested model answers |
| **Evaluator Agent** | Scores the user's submitted mock-interview answers against a rubric and returns dimension-based feedback |
| **Recovery Agent** | Classifies failures and decides between `retry_with_backoff` and `escalate` |
| **Monitoring Agent** | Emits a timeline event for every step of every agent, for every job |

**Recovery Agent failure classes:**
- `PARSE_FAILURE`
- `AI_PROVIDER_FAILURE`
- `MISSING_FIELDS`
- `RATE_LIMIT`
- `TRANSIENT`

**AI provider transparency:** every generation response must report which provider actually served the request:
`aiProvider: 'openrouter' | 'gemini' | 'deterministic-fallback'`

---

## 5. Background Processing Engine

- Every pipeline run is persisted as a `ProcessingJob` document
- Status values: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `RETRYING`, `CANCELLED`
- Job types: `resume_parse`, `resume_tailor`, `gap_analysis`, `ats_score`, `question_generation`, `answer_evaluation`
- Each job records: input references, output, error, duration, retry count
- One `ProcessingLog` row is written per agent event (full audit trail)
- Users can cancel a running job
- BullMQ on Redis handles background scheduling and retry backoff for every AI task
- In-memory fallback queue is used automatically when Redis is not configured, so local development always works

---

## 6. AI Generation Behavior & Fallback Chain

For **every** AI-driven task (parsing, tailoring, gap analysis, question generation, answer evaluation), the system follows this fallback order:

1. **OpenRouter** — used when `OPENROUTER_API_KEY` is set
2. **Google Gemini** — used when `GEMINI_API_KEY` is set and OpenRouter is unavailable
3. **Deterministic rule-based processor** — used when neither key is configured:
   - Parsing → regex/keyword-based skill and section extraction
   - Question generation → static role-based question bank
   - Gap analysis → keyword-overlap scoring

This guarantees the app is always demoable, even with zero AI API keys configured.

---

## 7. Real-Time Layer

- Socket.IO server broadcasts agent events (`parser`, `analyzer`, `generator`, `evaluator`, `recovery`, `monitoring`) for each processing job to subscribed clients
- Client renders these events as a **live progress timeline** (e.g., while a tailored resume or question set is being generated)
- Notifications generated during processing (job completed, job failed, new score available) persist in the database and appear in a notifications drawer

---

## 8. Frontend Pages

> Built on the Next.js **Pages Router**. The root `/` redirects authenticated users to `/dashboard` and unauthenticated users to `/login`.

| Route | Purpose |
|---|---|
| `/` | Landing page — platform introduction, feature highlights (tailor / prepare / apply), CTA buttons, responsive layout, dark theme support |
| `/login` | Email/password login form — JWT handling, Zustand persistence, validation, error states |
| `/register` | Registration form — password validation, session persistence, error handling |
| `/dashboard` | User console — resume count, average ATS score, interview score trend chart, application funnel summary, recent activity feed, live processing panel (AppShell layout) |
| `/resume/upload` | Drag-and-drop resume upload (react-dropzone), live parsing progress timeline, preview of extracted structured data |
| `/resume/[id]` | Resume detail — parsed structured data, list of tailored versions, ATS score, "Tailor for a role" action, "Run gap analysis against a JD" action |
| `/resume/[id]/tailor` | Role selector, optional JD paste box, tailored-resume generation, side-by-side diff view, PDF download |
| `/interview/setup` | Role selector, resume selector, optional JD selector, session-start action |
| `/interview/session/[id]` | Live Q&A interface — current question, "show suggested answer" toggle, answer box, submit-for-feedback, structured feedback panel |
| `/interview/history` | List of past sessions with scores, score-over-time chart, weak-topic heatmap |
| `/jobs` | Job Search Hub — role-categorized cards with AI-generated keywords and deep links (LinkedIn / Internshala / Naukri / Indeed) |
| `/applications` | Application tracker board — status columns, add/edit modal, notes, analytics summary |
| `/settings` | Profile management, AI provider health check (which provider is currently active), theme settings |

---

## 9. Backend Architecture

Strict layering — each layer has exactly one responsibility:

| Layer | Responsibility |
|---|---|
| **Routes** | HTTP routing, request validation via express-validator, middleware composition (auth, validation, error handler) |
| **Controllers** | Request parsing and response shaping only — **never** talks directly to MongoDB |
| **Services** | Owns all business logic: resume CRUD, file-parsing orchestration, tailoring orchestration, gap-analysis orchestration, interview-session lifecycle, application-tracker CRUD, notification creation, AI-provider selection, log aggregation |
| **Agents Layer** | Parser, Analyzer, Generator, Evaluator, Recovery, and Monitoring modules, plus the pipeline orchestrator that chains them per job type |
| **Providers Layer** | Wraps OpenRouter SDK and Google Generative AI SDK behind a common interface (`baseProvider.js`); the deterministic fallback is implemented behind the same interface |
| **Queues Layer** | Wraps BullMQ and Redis for every long-running AI job |
| **Config Layer** | Centralizes environment variables, MongoDB connection (with in-memory fallback), Cloudinary SDK config, Socket.IO setup |

**Hard rules:**
- Controllers never call Mongo directly
- Agents never call an AI provider directly — must go through the Providers layer
- Agents have no HTTP knowledge

---

## 10. Database Collections

| Collection | Key Fields |
|---|---|
| **Users** | `name`, `email`, `password` (select: false), `role: admin \| user`, `lastLogin` |
| **Resumes** | `owner`, `originalFileUrl`, `fileType`, `parsedData` (structured JSON: contact/skills/experience/education/projects), `atsScore`, `uploadedAt` |
| **TailoredResumes** | `resumeId`, `owner`, `targetRole`, `jobDescriptionId` (optional), `tailoredContent`, `atsScore`, `diffFromOriginal`, `version`, `createdAt` |
| **JobDescriptions** | `owner`, `rawText`, `parsedRequirements` (skills / experience-level / keywords), `targetRole` |
| **GapAnalyses** | `resumeId`, `jobDescriptionId`, `matchScore`, `mustHaveMissing`, `niceToHaveMissing`, `matchedSkills` (with supporting resume line references) |
| **InterviewSessions** | `owner`, `targetRole`, `resumeId`, `jobDescriptionId` (optional), `status: in_progress \| completed`, `overallScore`, `startedAt`, `completedAt` |
| **InterviewQuestions** | `sessionId`, `questionText`, `category: technical \| behavioral \| role_specific`, `difficulty`, `suggestedAnswer`, `userAnswer`, `feedback` (`clarityScore`, `relevanceScore`, `structureScore`, `technicalScore`, `comments`), `answeredAt` |
| **ProcessingJobs** | `owner`, `jobType`, `status`, `inputRef`, `output`, `error`, `duration`, `retryCount` |
| **ProcessingLogs** | `jobId`, `agent: parser \| analyzer \| generator \| evaluator \| recovery \| monitoring`, `level: info \| warning \| error \| success`, `message`, `metadata` |
| **JobSearchQueries** | `owner`, `targetRole`, `generatedKeywords`, `generatedLinks` (`linkedin`, `internshala`, `naukri`, `indeed`), `createdAt` |
| **Applications** | `owner`, `company`, `roleTitle`, `sourcePlatform`, `jobLink`, `status: saved \| applied \| oa \| interview \| offer \| rejected`, `appliedDate`, `notes`, `lastUpdated` |
| **Notifications** | `owner`, `jobId`, `type`, `title`, `message`, `isRead` |

---

## 11. API Endpoints

### Health & Auth
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | System heartbeat and status check |
| POST | `/api/auth/register` | Register a new user account |
| POST | `/api/auth/login` | Authenticate user and issue JWT |
| GET | `/api/auth/me` | Fetch current user profile |

### Resumes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/resumes/dashboard` | Aggregated resume, score, and session stats |
| GET | `/api/resumes` | List user's resumes |
| POST | `/api/resumes/upload` | Upload a resume file, enqueue parsing job |
| GET | `/api/resumes/:id` | Fetch a single resume with parsed data |
| DELETE | `/api/resumes/:id` | Delete a resume |
| POST | `/api/resumes/:id/tailor` | Generate a role-tailored version (`targetRole`, optional `jobDescriptionText`) |
| GET | `/api/resumes/:id/versions` | List tailored versions of a resume |
| GET | `/api/resumes/:id/ats-score` | Fetch or recompute ATS formatting score |
| POST | `/api/resumes/:id/gap-analysis` | Run gap analysis against a pasted/uploaded JD |
| GET | `/api/resumes/:id/download/:versionId` | Download a tailored version as PDF |

### Interview
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/interview/sessions` | Start a new session (`targetRole`, `resumeId`, optional `jobDescriptionId`); enqueues question generation |
| GET | `/api/interview/sessions` | List past sessions with scores |
| GET | `/api/interview/sessions/:id` | Fetch a session with its questions and answers |
| POST | `/api/interview/sessions/:id/questions/:qid/answer` | Submit a user answer; enqueues evaluation |
| GET | `/api/interview/sessions/:id/questions/:qid/suggested-answer` | Fetch the AI-suggested model answer |
| GET | `/api/interview/analytics` | Score trend and weak-topic aggregation across sessions |

### Job Search & Applications
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/jobs/search-links` | Generate role-aware deep-linked search URLs (`targetRole`, optional `resumeId` for keyword extraction) |
| GET | `/api/jobs/roles` | List supported role categories for the job hub |
| GET | `/api/applications` | List tracked applications with filter/sort/pagination |
| POST | `/api/applications` | Add a new tracked application |
| PUT | `/api/applications/:id` | Update status/notes of a tracked application |
| DELETE | `/api/applications/:id` | Remove a tracked application |
| GET | `/api/applications/analytics` | Funnel and weekly-volume analytics |

### Background Jobs & Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/processing-jobs/:id` | Fetch a background job's status and result |
| GET | `/api/processing-jobs/:id/timeline` | Fetch detailed agent timeline logs for a job |
| POST | `/api/processing-jobs/:id/cancel` | Cancel a running job |
| GET | `/api/notifications` | List user notifications |

---

## 12. Folder Structure

### Frontend Structure
```
client/
└── src/
    ├── components/
    │   ├── AppShell/
    │   ├── MetricGrid/
    │   ├── ResumeUploadDropzone/
    │   ├── ResumeDiffView/
    │   ├── QuestionCard/
    │   ├── FeedbackPanel/
    │   ├── JobRoleCard/
    │   ├── ApplicationBoard/
    │   ├── ProcessingTimeline/
    │   └── ProtectedRoute/
    ├── pages/
    │   ├── _app.js
    │   ├── index.js
    │   ├── login.js
    │   ├── register.js
    │   ├── dashboard.js
    │   ├── jobs.js
    │   ├── applications.js
    │   ├── settings.js
    │   ├── resume/
    │   │   ├── upload.js
    │   │   └── [id]/
    │   │       ├── index.js
    │   │       └── tailor.js
    │   └── interview/
    │       ├── setup.js
    │       ├── history.js
    │       └── session/
    │           └── [id].js
    ├── store/
    │   ├── authStore.js
    │   └── resumeStore.js
    └── services/
        ├── api.js
        └── socket.js
```

### Backend Structure
```
server/
└── src/
    ├── config/
    │   ├── env.js
    │   ├── db.js
    │   ├── cloudinary.js
    │   └── socket.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── resumeRoutes.js
    │   ├── interviewRoutes.js
    │   ├── jobRoutes.js
    │   ├── applicationRoutes.js
    │   ├── processingRoutes.js
    │   └── notificationRoutes.js
    ├── controllers/
    │   ├── authController.js
    │   ├── resumeController.js
    │   ├── interviewController.js
    │   ├── jobController.js
    │   └── applicationController.js
    ├── services/
    │   ├── authService.js
    │   ├── resumeService.js
    │   ├── tailoringService.js
    │   ├── gapAnalysisService.js
    │   ├── interviewService.js
    │   ├── jobSearchService.js
    │   ├── applicationService.js
    │   └── notificationService.js
    ├── agents/
    │   ├── orchestrator.js
    │   ├── parserAgent.js
    │   ├── analyzerAgent.js
    │   ├── generatorAgent.js
    │   ├── evaluatorAgent.js
    │   ├── recoveryAgent.js
    │   └── monitoringAgent.js
    ├── providers/
    │   ├── baseProvider.js
    │   ├── openRouterProvider.js
    │   ├── geminiProvider.js
    │   └── deterministicProvider.js
    ├── models/
    │   ├── User.js
    │   ├── Resume.js
    │   ├── TailoredResume.js
    │   ├── JobDescription.js
    │   ├── GapAnalysis.js
    │   ├── InterviewSession.js
    │   ├── InterviewQuestion.js
    │   ├── ProcessingJob.js
    │   ├── ProcessingLog.js
    │   ├── JobSearchQuery.js
    │   ├── Application.js
    │   └── Notification.js
    └── queues/
        └── processingQueue.js
```

---

## 13. Deployment Architecture

```
GitHub
   │
   ├──────────────► Vercel
   │                 │
   │                 │ Frontend (Next.js — client/)
   │                 ▼
   │              Users
   │
   └──────────────► Render
                     │
                     │ Backend API + Socket.IO (Express — server/)
                     ▼
              ┌──────┴──────┐
              │             │
       MongoDB Atlas   Cloudinary
       (database)      (resume files,
                         generated PDFs)
```

| Component | Platform | Notes |
|---|---|---|
| **Frontend** | Vercel | Deploys `client/` directly from GitHub; set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the Render backend URL |
| **Backend API + Socket.IO** | Render | Deploys `server/` as a Web Service; must be a persistent Node process (not a serverless function) so Socket.IO connections stay open |
| **Database** | MongoDB Atlas | Free M0 tier is sufficient for development and demo use |
| **File storage** | Cloudinary | Stores uploaded resumes (PDF/DOCX) and generated tailored-resume PDF exports; returns a secure URL saved as `originalFileUrl` / download URL in MongoDB |
| **Background queue** | Render (same service) + Redis | Use the in-memory fallback for a free deployment, or add a free-tier Redis add-on (e.g., Upstash) if persistent queues are needed |

**Environment variables to configure on each platform:**

| Variable | Set on | Purpose |
|---|---|---|
| `MONGODB_URI` | Render | MongoDB Atlas connection string |
| `JWT_SECRET` | Render | Signs/verifies auth tokens |
| `CLOUDINARY_CLOUD_NAME` | Render | Cloudinary account identifier |
| `CLOUDINARY_API_KEY` | Render | Cloudinary auth |
| `CLOUDINARY_API_SECRET` | Render | Cloudinary auth (never exposed to frontend) |
| `OPENROUTER_API_KEY` | Render | Primary AI provider |
| `GEMINI_API_KEY` | Render | Fallback AI provider |
| `REDIS_URL` | Render | Optional — omit to use in-memory queue fallback |
| `CLIENT_URL` | Render | Used for CORS restriction to the Vercel frontend domain |
| `NEXT_PUBLIC_API_URL` | Vercel | Points the frontend at the Render backend |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel | Points the Socket.IO client at the Render backend |

---

## 14. Development Phases

| Phase | Deliverables |
|---|---|
| **Phase 1** | Project setup — Next.js, Express, MongoDB with in-memory fallback, JWT authentication, Zustand auth store, AppShell layout |
| **Phase 2** | Resume upload, file-parsing pipeline (pdf-parse/mammoth), structured data extraction, resume CRUD, dashboard metadata persistence |
| **Phase 3** | AI resume tailoring (OpenRouter → Gemini → deterministic fallback), ATS scoring, gap analysis against a pasted JD |
| **Phase 4** | Interview module — question generation, suggested answers, answer submission and AI evaluation, session history and analytics |
| **Phase 5** | Agentic processing engine (parser, analyzer, generator, evaluator, recovery, monitoring) wired through the orchestrator, with BullMQ background queues and retry/backoff |
| **Phase 6** | Job Search Hub (role-categorized deep-link generation), Application Tracker (CRUD, status pipeline, analytics), Socket.IO real-time timeline streaming, notifications drawer |

---

## 15. UI & UX Requirements

- Clean, encouraging console aesthetic using Tailwind CSS
- Fully responsive across desktop and mobile
- Loading states and skeleton loaders — especially during AI generation, which can take several seconds
- Live processing timeline with **color-coded agent badges**: parser / analyzer / generator / evaluator / recovery / monitoring
- Resume diff view with clear added / removed / changed highlighting
- Interview feedback shown as a **dimension-based scorecard**, not a single number
- Notifications drawer accessible from the AppShell at all times
- Dark theme support

---

## 16. Security Requirements

- Passwords hashed with bcrypt, cost factor 12
- JWTs signed and verified with `JWT_SECRET`
- Uploaded file types and size restricted (PDF/DOCX only, size-capped) via multer before forwarding to Cloudinary
- Cloudinary uploads use signed, authenticated requests from the backend only — the frontend never receives Cloudinary API credentials, and unsigned client-side uploads are not used
- Cloudinary `CLOUDINARY_API_SECRET` is never exposed to the frontend or logged
- HTTP security headers set via helmet
- CORS restricted to `CLIENT_URL` (the deployed Vercel domain)
- Rate limiting on auth and AI-generation endpoints via express-rate-limit
- Every request body validated with express-validator
- Full resume content and AI provider keys are **never logged**
- **No credentials of any kind** are stored for LinkedIn, Internshala, Naukri, or Indeed — the Job Search Hub is link-generation only
- Any AI provider failure surfaces as an explicit `AI_PROVIDER_FAILURE` error in the processing timeline — never a silent failure or generic 500

---

## 17. Final Expected Outcome

A user should be able to:

1. Upload one resume and instantly see it parsed into structured data
2. Generate polished, tailored versions for any target role in seconds
3. Know exactly how ATS-compatible and JD-matched each version is
4. Walk into an interview having practiced role-specific questions with AI feedback on their actual answers
5. Move straight into a categorized job search with pre-built, resume-aware search links across major platforms
6. Track every application in one place, with analytics on their pipeline

The final application should feel like a **single connected career pipeline** — from "upload resume" to "apply and track" — rather than a set of disconnected tools.

---

## 18.AI Coding Agent Implementation Instructions

The AI coding agent must:

1. Build the application **phase by phase**, per Section 13
2. Follow the folder structure strictly (Section 12)
3. Keep controllers thin — push all logic into services
4. Keep agents pure — no HTTP knowledge, no direct MongoDB access
5. Wrap every AI provider behind the `baseProvider` interface
6. Never call MongoDB from a controller
7. Never call an AI provider from an agent without going through the Providers layer
8. Treat every secret as `process.env` — never hardcode
9. Use the in-memory store/queue fallback when MongoDB or Redis is unavailable, so local dev always works
10. Emit a Socket.IO event for every agent step of every processing job
11. Write one `ProcessingLog` per agent event
12. **Never** implement automated login, scraping, or auto-submission against LinkedIn, Internshala, Naukri, or Indeed — the Job Search Hub must remain link-generation only
13. Report the list of files created or changed at the end of every phase
