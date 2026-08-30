# CareerForge AI

CareerForge AI is a full-stack AI career readiness platform built to help users improve resumes, prepare for interviews, track job applications, and stay organized through a single workflow.

## 1. Project Name

CareerForge AI

## 2. Problem Statement

Job seekers often struggle with fragmented workflows: resume parsing is manual, ATS compatibility is hard to evaluate, tailoring a resume for different roles takes time, mock interview prep is disconnected, and application tracking is spread across multiple tools.

CareerForge AI solves this by combining resume analysis, AI-powered tailoring, ATS scoring, skill gap analysis, mock interview planning, and application tracking into one integrated platform.

## 3. Features

- Resume upload and parsing for PDF, DOCX, and TXT files
- AI-powered structured extraction of contact details, education, experience, skills, and projects
- ATS score analysis for formatting, structure, keyword alignment, and length
- Role-based resume tailoring with diff view and PDF export
- Job description gap analysis to identify missing skills and recommendations
- Mock interview setup with AI-generated questions and evaluation
- Interview history and performance tracking
- Job search hub with curated external job discovery links
- Application tracking dashboard with workflow stages
- Real-time updates using Socket.IO
- Authenticated user experience with JWT-based access control
- Fallback deterministic AI engine when external providers fail

## 4. Technology Stack

### Frontend
- Next.js
- React
- Tailwind CSS
- Lucide Icons
- Socket.IO client
- Zustand for state management

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Redis with BullMQ
- Socket.IO
- JWT authentication
- Multer for file uploads

### AI / External Services
- OpenRouter API
- Google Gemini API
- Cloudinary
- Deterministic offline fallback engine

### Other Tools
- Axios
- Express Validator
- Helmet
- CORS
- Compression
- Rate limiting

## 5. Screenshots

Below are key UI screens from the design system used in the project:

### Landing Page
![Landing Page](./Design-v2/landing_page_bauhaus_style/screen.png)

### Dashboard
![Dashboard](./Design-v2/dashboard_bauhaus_style/screen.png)

### Resume Tailor
![Resume Tailor](./Design-v2/resume_tailor_bauhaus_style/screen.png)

### Job Search Hub
![Job Search Hub](./Design-v2/job_search_hub_bauhaus_style/screen.png)

### Interview Setup
![Interview Setup](./Design-v2/interview_setup_bauhaus_style/screen.png)

### Interview Session
![Interview Session](./Design-v2/interview_session_bauhaus_style/screen.png)

### Application Tracker
![Application Tracker](./Design-v2/application_tracker_bauhaus_style/screen.png)

### Auth Flow
![Auth Flow](./Design-v2/auth_flow_bauhaus_style/screen.png)

### Settings
![Settings](./Design-v2/settings_bauhaus_style/screen.png)

## 6. Live Demo

Live Demo (Vercel):
- https://your-project.vercel.app

Replace this with your actual deployed frontend URL.

## 7. Backend

Backend API (Render):
- https://your-render-service.onrender.com

Replace this with your actual deployed backend URL.

## 8. Setup Instructions

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas account or local MongoDB instance
- Redis instance (or use fallback behavior)
- Cloudinary account (optional for production uploads)
- OpenRouter and Gemini API keys (optional if using deterministic fallback)

### 1. Clone the repository

```bash
git clone https://github.com/darekarbro/Agentic-AI-Automation.git
cd Agentic-AI-Automation
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `server` folder and add the required values.

### 4. Start the backend server

```bash
npm run dev
```

The backend will run on:
- http://localhost:5000

### 5. Install frontend dependencies

```bash
cd ../client
npm install
```

### 6. Configure frontend environment variables

Create a `.env.local` file inside the `client` folder and add the frontend variables.

### 7. Start the frontend

```bash
npm run dev
```

The frontend will run on:
- http://localhost:3000

### 8. Access the application

Open:
- http://localhost:3000

## 9. Environment Variables

The following environment variables are required for full functionality. Do not expose real values in GitHub or public files.

### Server (`server/.env`)

```env
PORT
NODE_ENV
CLIENT_URL
JWT_SECRET
MONGODB_URI
OPENROUTER_API_KEY
OPENROUTER_MODEL
GEMINI_API_KEY
GEMINI_MODEL
AI_PROVIDER_TIMEOUT_MS
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
REDIS_URL
```

### Client (`client/.env.local`)

```env
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SOCKET_URL
```

## Project Summary

CareerForge AI brings together resume intelligence, interview preparation, job search support, and application management in one AI-powered workflow. It is designed for users who want a structured, guided system to improve career readiness and increase job application effectiveness.

## License

This project is for educational and portfolio use unless otherwise stated by the repository owner.shboard` — KPI console (Resumes, ATS Scores, Interview Readiness, App Pipeline).- `/resume/upload` — Drag-and-drop file upload with live agent streaming timeline.
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
