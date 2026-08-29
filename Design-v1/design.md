# CareerForge AI — Design Specification

> This document is written to be used as a design brief for Google Stitch (or any AI UI-generation tool). Each screen section is self-contained and can be pasted individually as a Stitch prompt, or the whole document can be used as project-level context.

---

## 1. Design Brief & Brand Personality

**Product:** CareerForge AI — an AI career-readiness platform (resume tailoring, mock interviews, job search, application tracking).

**Personality:** Confident, precise, forward-moving. The metaphor is a *forge* — raw material (a resume) goes in, heat and pressure (AI processing) are applied, and something stronger comes out. The UI should feel like a focused technical console, not a soft consumer app — closer to a developer tool or trading dashboard than a typical "job board" site, because the user is doing serious preparation work, not casually browsing.

**Tone of visual language:** Dark-first, high-contrast, precise typography, purposeful use of a warm accent color against a cool neutral base — literally evoking "ember on steel." Motion should feel mechanical and responsive (progress bars, live timelines, status transitions) rather than bouncy or playful.

**Primary theme:** Dark mode is the default and primary designed experience. Light mode is a secondary supported theme using the same token system inverted.

---

## 2. Implementation Stack Reference

This document is design-focused and intentionally stack-agnostic for feeding into Stitch or any other AI design tool. For reference, the frontend will ultimately be implemented with:

| Layer | Technology |
|---|---|
| Framework | Next.js (Pages Router), React 19 |
| Styling | Tailwind CSS — design tokens in Section 3 should map to a Tailwind theme config (colors, fontFamily, spacing, borderRadius extensions) |
| State management | Zustand |
| HTTP client | Axios |
| Real-time | Socket.IO client (drives the Processing Timeline component in Section 6.1) |
| File upload | react-dropzone (Resume Upload screen, Section 5.5) |
| Charts | recharts (Score Trend, Application Funnel, Weak Topic Heatmap) |
| Icons | lucide-react |

Any generated component output (from Stitch or otherwise) should be translated into React functional components using Tailwind utility classes, with colors/spacing/typography pulled from a shared `theme.js`/`tailwind.config.js` rather than hardcoded per component, so the design system in Section 3 stays the single source of truth.

Full backend/database/deployment stack is documented separately in `SPECS.md`, Section 2.

---

## 3. Design System

### 3.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `bg-base` | `#0B0D10` | App background (dark theme) |
| `bg-surface` | `#15181D` | Cards, panels, sidebar |
| `bg-surface-raised` | `#1D2127` | Modals, dropdowns, elevated elements |
| `bg-surface-hover` | `#22262D` | Hover state on surfaces |
| `border-subtle` | `#262A31` | Default borders, dividers |
| `border-strong` | `#383D45` | Focus rings, emphasized borders |
| `text-primary` | `#EDEEF1` | Headings, primary content |
| `text-secondary` | `#9AA0AB` | Body copy, descriptions |
| `text-muted` | `#5B6070` | Placeholder text, disabled states |
| `accent-ember` | `#FF6B35` | Primary accent — CTAs, active states, key highlights |
| `accent-ember-hover` | `#FF8555` | Hover state for ember accent |
| `accent-ember-muted` | `#3D2318` | Ember-tinted backgrounds (badges, subtle highlights) |
| `accent-steel` | `#2DD4BF` | Secondary accent — AI/processing elements, links, info states |
| `accent-steel-muted` | `#0F2E2B` | Steel-tinted backgrounds |
| `success` | `#3DD68C` | Resolved states, positive scores, offers |
| `warning` | `#F5B84F` | Pending states, medium scores |
| `error` | `#F2545B` | Failed states, low scores, destructive actions |
| `chart-1` … `chart-5` | `#FF6B35, #2DD4BF, #F5B84F, #8B7CF6, #3DD68C` | Chart series colors, in this order |

**Light theme mapping** (same tokens, inverted lightness): `bg-base → #F7F7F8`, `bg-surface → #FFFFFF`, `text-primary → #14161A`, `text-secondary → #565C68`, accents remain the same hex values for brand consistency.

### 3.2 Typography

| Role | Font | Weight | Size / Line-height |
|---|---|---|---|
| Display / Hero | Space Grotesk | 700 | 48px / 56px |
| Page Title (H1) | Space Grotesk | 600 | 32px / 40px |
| Section Title (H2) | Space Grotesk | 600 | 24px / 32px |
| Card Title (H3) | Space Grotesk | 600 | 18px / 26px |
| Body | Inter | 400 | 15px / 24px |
| Body Small | Inter | 400 | 13px / 20px |
| Label / Caption | Inter | 500 | 12px / 16px, letter-spacing 0.02em, uppercase for section labels |
| Monospace (scores, code, IDs) | JetBrains Mono | 500 | 14px / 20px |

Space Grotesk gives headings a slightly technical, geometric character (avoids the generic-SaaS feel of Inter-everywhere). Inter is used for body copy for maximum readability. JetBrains Mono is used specifically for numeric scores (ATS score, match %, session scores) to give them a "readout" feel, like a measurement.

### 3.3 Spacing Scale

Base unit: 4px. Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.
- Component internal padding: 16–24px
- Card padding: 24px
- Section gaps: 48–64px
- Page horizontal margin: 32px (desktop), 16px (mobile)

### 3.4 Radius, Elevation, Borders

- Small elements (badges, chips, buttons): `8px` radius
- Cards, panels, modals: `16px` radius
- Avatars, status dots: full circle
- Elevation is expressed with a **1px border** (`border-subtle`) plus a very soft outer glow (`0 0 0 1px rgba(255,107,53,0.08)` on hover/active for ember-accented elements) rather than heavy drop shadows — this keeps the dark theme feeling flat and precise rather than muddy.
- Active/selected cards get a 1.5px `accent-ember` border instead of a shadow.

### 3.5 Iconography

lucide-react icon set throughout. Icons are 20px in nav/toolbar contexts, 16px inline with text, 24px for empty-state illustrations. Icons use `text-secondary` by default and switch to `accent-ember` or `accent-steel` when representing an active/selected state.

### 3.6 Motion

- Standard transition: 160ms ease-out for hover/focus states
- Panel/modal entrance: 220ms ease-out, slight upward slide (8px) + fade
- Live processing timeline: each new agent-step entry slides in from the left with a 300ms stagger, mimicking a build/log console
- Progress bars use a subtle animated gradient sweep (ember → steel) while a job is `RUNNING`, and lock to solid `success` green when `COMPLETED`

---

## 4. Global Layout — AppShell

Used on every authenticated page (`/dashboard`, `/resume/*`, `/interview/*`, `/jobs`, `/applications`, `/settings`).

**Structure:**
- **Left sidebar** (fixed, 240px wide, collapsible to 72px icon-only on toggle): logo/wordmark at top, primary nav items (Dashboard, Resumes, Interview Prep, Job Search, Applications, Settings) each with a lucide icon + label, active item highlighted with `accent-ember-muted` background and `accent-ember` left border (3px). User profile summary pinned at the bottom of the sidebar (avatar, name, dropdown for logout/theme toggle).
- **Top bar** (56px height, spans remaining width): breadcrumb/page title on the left, global search (optional, spotlight-style) in the center, notification bell icon (with unread-count badge) and AI-provider health indicator dot (green = OpenRouter/Gemini live, amber = deterministic fallback active) on the right.
- **Main content area:** 32px padding, max-width 1280px centered on very large screens, single-column flow of section cards.
- **Notifications drawer:** slides in from the right (360px wide) when the bell icon is clicked, overlays content with a scrim, lists notifications newest-first, each with an icon by type (success/error/info), timestamp, and read/unread dot.

**Mobile behavior (< 768px):** sidebar collapses into a bottom tab bar (5 primary destinations: Dashboard, Resumes, Interview, Jobs, More) or a hamburger-triggered full-screen nav drawer; top bar remains but search collapses into an icon.

---

## 5. Screen-by-Screen Specifications

### 5.1 Landing Page — `/`

**Purpose:** Convert a visitor into a signup. Public, unauthenticated.

**Layout:**
- **Hero section:** full-width, `bg-base` with a subtle animated ember/steel gradient mesh in the background (very low opacity, decorative only). Centered content: eyebrow label ("AI Career Copilot"), large Display headline ("Forge a career-ready you"), supporting body text (1–2 sentences on the parse → tailor → prepare → apply pipeline), two CTAs side by side — primary ember-filled button "Get Started Free" and secondary ghost/outline button "See how it works."
- **Product visual:** below the hero, a large mockup/screenshot placeholder of the dashboard or the live processing timeline, framed in a card with a soft ember glow border to draw the eye.
- **Feature highlight row:** 4-column grid (stacks to 1 column on mobile) — each column is an icon + short title + one-line description, covering: "Tailor Instantly," "Practice Realistically," "Search Smarter," "Track Everything."
- **How it works section:** horizontal 4-step timeline (Upload → Tailor → Prepare → Apply) with connecting line, each step a numbered node with icon and label.
- **Social proof / stats bar:** optional row of 3–4 stat callouts (e.g., "10,000+ resumes tailored") in monospace numerals.
- **Footer CTA band:** full-width `bg-surface` band with centered headline + single CTA button before the footer.
- **Footer:** standard multi-column link footer (Product, Company, Legal) on `bg-base`.

**States:** none beyond scroll-triggered fade-in animations on each section.

---

### 5.2 Login — `/login`

**Layout:** Centered single card (max-width 400px) on a full-height `bg-base` page, optionally with the same subtle background gradient mesh as the landing hero at very low opacity. Card contains: logo mark, "Welcome back" H2, email field, password field (with show/hide toggle icon), "Forgot password?" link right-aligned under the password field, primary ember-filled submit button (full width), divider with "or" label, and a link to `/register` below the card ("Don't have an account? Sign up").

**States:**
- Default
- Field-level validation error (red border + inline error text under the field)
- Submitting (button shows a spinner and disables)
- Auth error (a dismissible error banner above the form, `error` colored, e.g., "Invalid email or password")

---

### 5.3 Register — `/register`

Same card layout as Login, fields: name, email, password, confirm password, with a password-strength meter (thin 4-segment bar under the password field, colored `error` → `warning` → `success` as strength increases). Terms-of-service checkbox required before the submit button activates. Link back to `/login` below the card.

---

### 5.4 Dashboard — `/dashboard`

**Purpose:** At-a-glance status of the user's whole pipeline.

**Layout (top to bottom):**
1. **Page header:** "Welcome back, {name}" H1 + subtext with today's date; a prominent "Upload New Resume" ember button top-right.
2. **Metric grid:** 4 stat cards in a row (stacks 2×2 on tablet, 1-column on mobile) — "Resumes," "Avg ATS Score," "Interview Sessions," "Applications Sent" — each card shows a large monospace number, a small label, and a tiny trend indicator (↑/↓ with percentage in `success`/`error`).
3. **Two-column section:** left column (60% width) holds the **Interview Score Trend** line chart (recharts, ember line on a dark grid); right column (40% width) holds the **Application Funnel** — a vertical funnel/stage-bar visualization (Saved → Applied → OA → Interview → Offer) with counts per stage.
4. **Recent Activity feed:** a card listing the last ~8 events (resume tailored, session completed, application status changed) as a vertical timeline with icon, description, and relative timestamp.
5. **Live Processing panel:** if any background job is currently running, a persistent card at the bottom (or docked bottom-right as a floating panel) shows the live agent timeline (see Section 6.1 — Processing Timeline Component) for that job.

**States:** empty-state variant for a brand-new user (no resumes yet) replaces the metric grid + charts with a single centered empty-state illustration and a "Upload your first resume" CTA.

---

### 5.5 Resume Upload — `/resume/upload`

**Layout:** Centered single-column flow, max-width 640px.
- H1 "Upload your resume" + subtext.
- Large dropzone card (react-dropzone): dashed `border-subtle` rectangle, centered upload-cloud icon, "Drag & drop your resume, or click to browse" text, accepted formats note ("PDF or DOCX, up to 5MB").
- On file selected: dropzone collapses into a compact file-chip (filename, size, remove ✕ icon) above a "Parse Resume" primary button.
- On submit: the dropzone area is replaced by the **Processing Timeline component** (see Section 6.1), showing live agent steps: Parser Agent → (Monitoring events) → Complete.
- On completion: a **Parsed Data Preview** card appears below — sectioned display of extracted Contact / Skills (as chips) / Experience / Education / Projects, each section collapsible, with an "Looks good, continue" button that routes to `/resume/[id]`.

**States:** idle (empty dropzone), file-selected, uploading, parsing (live timeline), parse error (red banner: "We couldn't read that file — try a different format" with retry button), success.

---

### 5.6 Resume Detail — `/resume/[id]`

**Layout:**
- Header row: resume file name as H1, upload date subtext, action buttons top-right ("Tailor for a Role" ember button, "Run Gap Analysis" outline button, overflow menu for delete/rename).
- **ATS Score card:** prominent card near the top — large circular score gauge (0–100, colored by band: red < 50, amber 50–75, green > 75) on the left, breakdown checklist on the right (formatting, keyword density, length, section structure — each with a check/warning icon).
- **Parsed data sections:** tabbed or accordion layout — Contact, Skills (chip cloud), Experience (card per role with bullet list), Education, Projects, Certifications.
- **Tailored Versions list:** a horizontal scrollable row of version cards below, each showing target role badge, ATS score, created date, and a "View" action — clicking opens `/resume/[id]/tailor` pre-loaded with that version.

---

### 5.7 Resume Tailor — `/resume/[id]/tailor`

**Layout:** Two-panel split view (stacks vertically on mobile).
- **Left control panel (320px):** role selector (chip/segmented control: SDE, Fullstack, Backend, Frontend, Data/ML, DevOps, Product, Custom-text-input), optional collapsible "Paste a Job Description" textarea, primary "Generate Tailored Resume" ember button, and below it the ATS score gauge for the currently-generated version (updates live).
- **Right panel (remaining width):** **diff view** — two side-by-side scrollable columns ("Original" / "Tailored for {role}"), with line-level highlighting: additions in a `success`-tinted background, removals with strikethrough on an `error`-tinted background, unchanged text neutral. A toggle above the diff switches between "Diff View" and "Clean Preview" (just the final tailored resume, formatted).
- Bottom-right sticky action bar: "Download PDF" and "Save Version" buttons.

**States:** empty (no version generated yet — right panel shows a centered placeholder), generating (right panel replaced by the Processing Timeline component), populated diff, error state (generation failed banner with retry).

---

### 5.8 Interview Setup — `/interview/setup`

**Layout:** Centered single-column form, max-width 560px, presented as a 3-step wizard (progress dots at top):
1. **Select role** — same chip/segmented control as the tailor screen.
2. **Select resume** — card-list picker of the user's resumes/tailored versions (radio-style selectable cards).
3. **Optional JD** — textarea to paste a JD, with a clear "skip this step" link.
Final step shows a summary card ("SDE interview, using [Resume Name], tailored to [Company/JD if provided]") with a large "Start Session" ember button.

---

### 5.9 Interview Session — `/interview/session/[id]`

**Purpose:** The core "live" experience — needs to feel focused and low-distraction.

**Layout:**
- **Top progress bar:** thin bar showing question N of Total, with category tag chip (Technical / Behavioral / Role-specific) and a difficulty dot indicator.
- **Question card:** centered, large card with the question text in H3 size, a subtle "Reveal suggested answer" toggle link below it (collapsed by default — revealing it slides open an ember-bordered inset panel with the model answer).
- **Answer input:** large textarea below the question card, character/word count in the corner, "Submit Answer" primary button.
- **Feedback panel (appears after submission):** replaces the answer input area with a **dimension scorecard** — 4 horizontal bars (Clarity, Relevance, Structure, Technical Correctness), each labeled with a 0–100 score in monospace and colored by band, followed by a short AI comments paragraph. Below that, "Next Question →" button.
- **Session end screen:** replaces the whole card with a summary — overall score gauge (large, centered), per-dimension average bars, "weak topic" callout chips, and two buttons: "Review Answers" (expands an accordion of every Q&A + feedback) and "Back to Dashboard."

**States:** question loading (skeleton card), answer submitting (button spinner), feedback revealed, session complete.

---

### 5.10 Interview History — `/interview/history`

**Layout:**
- **Score trend chart** at top, full-width (recharts line chart, x-axis = session date, y-axis = overall score, ember line with steel-colored dot markers).
- **Weak Topic Heatmap:** a grid/matrix card below — rows = topic categories, columns = recent sessions, cells colored on a red→green gradient by score, giving an at-a-glance pattern view.
- **Session list:** table/list below — each row: date, target role, overall score (monospace, colored badge), question count, "View" link. Sortable by date or score.

---

### 5.11 Job Search Hub — `/jobs`

**Layout:**
- H1 "Job Search Hub" + subtext explaining the deep-link approach ("We generate smart search links — you apply directly on each platform").
- **Role card grid:** responsive grid (3 columns desktop, 1 mobile) — one card per role category (SDE, Fullstack, Backend, Frontend, Data, DevOps, Product). Each card: role icon + title, small text showing the AI-generated keyword string used (e.g., `"SDE · React · Node · 1-3 yrs"`), and 4 platform buttons in a row (LinkedIn, Internshala, Naukri, Indeed) — each a small pill button with the platform's icon/wordmark, opening the deep link in a new tab.
- A "Custom Role" card at the end of the grid with a text input to generate links for any typed role.

**States:** keyword-generation loading skeleton on each card while the AI derives resume-aware keywords; once generated, keywords are cached and shown instantly on revisit.

---

### 5.12 Application Tracker — `/applications`

**Layout:** Kanban board, 5 columns (Saved, Applied, OA, Interview, Offer/Rejected split as two sub-lanes or a single "Offer/Rejected" column with a status tag distinguishing them). Each column header shows count. Cards within columns: company name (bold), role title, source platform icon, applied date, small notes-preview if present — draggable between columns to update status. "+ Add Application" button top-right opens a modal (company, role, source, link, date, notes fields).

Above the board: a compact analytics strip — applications this week (monospace number + trend), and a funnel conversion percentage between each stage.

**States:** empty column placeholder text ("No applications here yet"), drag-in-progress visual (card lifts with shadow + ember outline on the target column).

---

### 5.13 Settings — `/settings`

**Layout:** Single column, max-width 720px, sectioned into cards:
- **Profile card:** avatar upload, name, email (read-only or editable per auth design), "Save Changes" button.
- **AI Provider Health card:** three rows (OpenRouter, Gemini, Deterministic Fallback) each with a status dot (green/red/gray) and last-used timestamp — read-only diagnostic view.
- **Appearance card:** theme toggle (Dark / Light / System) as a segmented control.
- **Danger Zone card:** bordered in `error` color, contains "Delete Account" with a confirmation modal requiring the user to type their email to confirm.

---

## 6. Shared Components

### 6.1 Processing Timeline Component
Used on Resume Upload, Resume Tailor, and as a floating panel on the Dashboard. A vertical log-style list: each entry is a row with an agent-colored icon (Parser = steel, Analyzer = ember, Generator = purple `#8B7CF6`, Evaluator = green, Recovery = amber, Monitoring = gray), the event message in monospace-adjacent small text, and a relative timestamp. New entries animate in from the top. A slim overall progress bar sits above the log. On completion, the whole panel gets a subtle green success flash border.

### 6.2 Score Gauge
Circular gauge component reused for ATS Score, Match Score, and Interview Overall Score. SVG arc, 270° sweep, colored by band (red/amber/green), large monospace number centered inside, small label beneath.

### 6.3 Status Badge
Pill-shaped, small, used for application status, job status, session status. Background is the status color at 15% opacity, text/border at full color.

### 6.4 Empty States
Every list/board screen has a defined empty state: centered icon (64px, `text-muted`), H3 message, one-line supporting text, and a single relevant CTA button.

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| `mobile` | < 640px | Single column everywhere, sidebar → bottom tab bar, diff view stacks vertically, Kanban board becomes horizontally-scrollable single-row columns |
| `tablet` | 640–1024px | 2-column grids where desktop uses 3–4, sidebar collapses to icon-only by default |
| `desktop` | 1024–1440px | Full layout as specified above |
| `wide` | > 1440px | Content max-width caps at 1280px, centered, extra space becomes page margin |

---

## 8. Accessibility Notes

- Minimum contrast ratio 4.5:1 for all body text against its background (verify `text-secondary` on `bg-base` and `bg-surface`)
- All interactive elements have a visible focus ring using `accent-steel` at 2px offset
- Score gauges and colored badges always pair color with a text/number, never color alone, for colorblind accessibility
- All icons used as standalone buttons (e.g., notification bell, remove ✕) have `aria-label`s
