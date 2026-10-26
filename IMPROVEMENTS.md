# Product improvements

This branch builds on errors-fixed. Review and merge the fixes separately before merging this work.

## Scope

- [x] Editable career profile and resume facts, with revision history and conflict protection.
- [x] Per-change AI review, manual editing, undo/redo and section regeneration.
- [x] Job workspaces connecting descriptions, resumes, interviews and applications.
- [x] Guided onboarding and a clear next-action dashboard.
- [x] Plain-language navigation, readable text, keyboard focus and mobile controls.
- [x] Account-scoped persistent drafts and an activity centre with recovery/retry.
- [x] Stable, explainable resume assessments and actionable section feedback.
- [x] Job-specific interview difficulty, timed practice, retry and focused follow-up.
- [x] Searchable applications with exact resume versions, dates and follow-up notes.
- [x] Resume templates, actual PDF preview settings and editable DOCX export.
- [x] Honest loading/error/empty states and useful personal progress metrics.
- [x] Durable job recovery, request usage visibility and regression fixtures.

## Validation

Each feature includes ownership and validation checks where applicable. The complete backend/frontend suites, lint, production build and representative browser workflows are required before review. External AI checks use fictional data only. Environment files, uploads and test intermediates stay untracked.

Validation performed with Node 24:

- Backend: 59 tests, including ownership, concurrent answers, revision conflicts, expired assessment caches, encrypted retries and recovery of partially committed work.
- Frontend: 16 tests covering the existing regressions plus draft persistence, edits during saves, account isolation, AI review decisions and application-editor recovery.
- ESLint: no errors or warnings. Production build: all 22 routes generated successfully.
- Chrome: registration, onboarding, profile/resume editing and refresh, saved job analysis/tailoring, review choices, PDF preview, DOCX download, application search/dates/version copy, timed interviews, delayed feedback, answer retry, activity/results, mobile navigation and logout cleanup.
- Live Groq: all six AI actions plus scoped project regeneration, Hard questions, answer retry and token usage passed with fallback disabled (11 real requests, fictional data only).
- Export QA: all pages of the three long-resume PDF layouts rendered and inspected; late experience, projects, education and certifications retained. DOCX re-read with Mammoth to verify content.
- Security: both dependency audits report zero known vulnerabilities. Credential-value scan found no matches in tracked changes.

Browser acceptance uses the local API and an isolated database. Cloudinary, Redis and Google sign-in integrations have automated coverage; live checks for those services require their own configured credentials/infrastructure.

## Operational details

- Profile and resume drafts autosave with optimistic revisions. Browser drafts expire after 24 hours and are cleared on logout/account changes. Source resume history keeps the last 20 revisions; tailored edits keep the last 30.
- AI review retains a source snapshot. Exports use saved reviewed content; applications capture an independent copy of the selected version and edit revision.
- Quality assessments reuse a content/model/rubric fingerprint. Job-match reports remain separate. Edits mark previous quality estimates stale; delayed feedback stays hidden until the interview is complete.
- Timers are practice reminders, persist through refreshes, and do not submit answers automatically. Retries retain prior attempts and replace the question's score in session averages.
- Recovery uses MongoDB worker leases and job identities. Retry payloads use AES-256-GCM and expire after 24 hours. Persistent MongoDB is required for restart durability; changing the payload encryption secret invalidates existing retry inputs.
- Usage records contain action/provider/model, latency, status and reported token counts. They do not include resumes, job descriptions or interview answers. Tokens are shown only when the provider reports them.
- Dependency patches include Next.js 16.4.3 and a compatible gRPC override for Firebase's transitive dependency. Both package audits report zero known vulnerabilities at validation time.

## Review order

Review and merge `errors-fixed` first. The `Improvement` branch starts at that commit, so its pull request targets `errors-fixed` to show only the product changes. Neither pull request is merged automatically.
