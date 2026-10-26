**CareerForge AI — full project bug audit**

**Remediation update, 25 October 2026:** The 52 findings below describe the original audited state. Their fixes and current verification are recorded in [BUG_FIX_REPORT.md](BUG_FIX_REPORT.md).

Reviewed 25 October 2026. **52 findings: 12 high-priority (P1), 40 medium-priority (P2).** P1 means a serious account/privacy, authentication, or resume-integrity issue to address before production use. P2 covers broken functionality, reliability and validation tooling.

The audit covered all 95 application source files under the server and client source directories, their configuration/manifests, the existing test, and the setup/specification documentation. Design-v1 and Design-v2 are historical reference exports, not imported application routes. Application code was not changed.

43 findings have runtime, component, controlled-service or command-level evidence; nine are marked **Source** and were established by tracing the relevant code. The probes used synthetic users/resumes in an isolated local MongoDB with its real unique indexes, temporary localhost HTTP/Socket.IO servers, and disabled external service credentials. Frontend probes transpiled the actual modules with controlled hooks, storage and socket stubs; they were not browser end-to-end tests. Firebase identity-claim and provider-failure probes were stubbed as stated below. No production data or deployed services were modified.

**Validation results**

- All 60 backend JavaScript source files passed Node syntax checks.
- The existing Firebase normalization test passed when invoked directly: one test passed.
- `npm --prefix server test` failed because its target test file is missing.
- `npm --prefix client run lint` failed because `next lint` is not supported by the installed version.
- `npm --prefix client run build -- --webpack` passed and generated the application's static routes.
- The default Turbopack build failed in its CSS/PostCSS child-process setup in this execution environment. Because the Webpack production build passed, this is recorded as an environment/build limitation rather than an additional confirmed source bug.
- 42 targeted defect probes reproduced the described behavior; these cover 41 distinct findings because both processing cancellation runners were probed. Together with the two broken repository commands, they support the 43 evidence-backed findings above.

**Complete findings**

**01. [P1] Local registration fails after the first local account**

Every local registration stores firebaseUid as an empty string. The unique sparse index still indexes that value, so a second unrelated email fails with E11000 and HTTP 400. Reproduced against a fresh MongoDB with the actual index enabled.

Location: [server/src/models/User.js:6](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/models/User.js#L6). Verification: **Runtime**. Suggested fix: Omit firebaseUid until a Firebase identity exists; migrate empty values and use an appropriate partial unique index.

**02. [P1] Profile updates allow users to assign protected account fields**

PUT /api/auth/me passes the entire request body into $set. An ordinary user can persist role: admin; email, firebaseUid, authProvider and other account fields are also writable. The isolated API returned 200 with the new admin role.

Location: [server/src/services/authService.js:209](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/authService.js#L209). Verification: **Runtime**. Suggested fix: Allowlist editable profile fields such as name and targetRolePreference; handle identity changes separately.

**03. [P1] Updating a password stores plaintext and breaks password login**

The same profile endpoint accepts password through findByIdAndUpdate, which bypasses the User pre-save hashing hook. A synthetic new password was stored literally; logging in with it then returned 401.

Location: [server/src/services/authService.js:210](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/authService.js#L210). Verification: **Runtime**. Suggested fix: Reject password in general profile updates and implement a dedicated authenticated password-change flow that hashes the replacement.

**04. [P1] Firebase login can link an unverified email to an existing account**

The backend verifies the ID token but never requires email_verified or the intended Google sign-in provider before finding an account by email and issuing its app token. A stubbed valid-token result with an unverified email and password provider received the existing account's JWT. Exploitation depends on the Firebase project accepting a provider that can issue unverified-email identities; a live Firebase exploit was not attempted.

Location: [server/src/services/authService.js:86](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/authService.js#L86). Verification: **Mocked identity**. Suggested fix: Enforce verified email and the intended identity provider before account linking; require explicit linking where identities differ.

**05. [P1] WebSocket clients can read other users' private activity without authentication**

A client connected without a token, joined another user's room by supplying its ID, and received a private notification. Separately, io.emit at line 59 broadcasts every timeline event, userId and jobId to every connected client, without even requiring room membership.

Location: [server/src/config/socket.js:15](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/config/socket.js#L15). Verification: **Runtime**. Suggested fix: Authenticate socket handshakes, derive user rooms from the verified identity, check job ownership, and remove the global private-event broadcast.

**06. [P1] Processing timelines are readable across accounts**

GET /api/processing-jobs/:id/timeline queries only jobId. User B received User A's private log even though the job-status endpoint correctly checks ownership.

Location: [server/src/controllers/processingController.js:24](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/controllers/processingController.js#L24). Verification: **Runtime**. Suggested fix: Verify ProcessingJob ownership before returning logs, or constrain the log query by both owner and jobId.

**07. [P1] Locally stored resume originals are public**

The /uploads static mount runs without authentication or ownership checks. A synthetic private resume file was fetched with HTTP 200 without a token. This affects fallback storage whenever Cloudinary is absent or an upload fails over locally; possession of the URL is sufficient.

Location: [server/src/app.js:51](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/app.js#L51). Verification: **Runtime**. Suggested fix: Serve originals through an authenticated ownership-checked download endpoint or use private object storage with expiring access.

**08. [P1] Fallback parsing invents a candidate's work history and qualifications**

A minimal literature-student resume acquired a fabricated employer, engineering experience, computer-science degree, projects, AWS certification and contact defaults. The parser inserts these hardcoded records rather than extracting them, and the provider factory uses it automatically when AI providers fail.

Location: [server/src/providers/deterministicProvider.js:70](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L70). Verification: **Runtime**. Suggested fix: Extract only supported facts; keep unknown fields empty and surface degraded parsing explicitly.

**09. [P1] Fallback tailoring invents skills and measurable achievements**

Tailoring injected unclaimed Node.js/Express/PostgreSQL/Redis skills and a fixed 42% throughput improvement into an experience bullet. These claims become saved resume content and PDF output.

Location: [server/src/providers/deterministicProvider.js:297](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L297). Verification: **Runtime**. Suggested fix: Preserve candidate facts and metrics; restrict tailoring to supported wording, ordering and emphasis.

**10. [P1] Signing out leaves the previous user's resume data in shared frontend state**

logout clears only the auth store and localStorage. The independent resume store retains dashboardMetrics, activeResume, tailoredVersions and activeJobTimeline. Logging in as User B in the same SPA retained User A's private dashboard and timeline; failed or delayed fetches can continue displaying them.

Location: [client/src/store/authStore.js:86](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/store/authStore.js#L86). Verification: **Component/store probe**. Suggested fix: Reset all user-scoped stores on logout and account changes, and clear stale data before fetching another account's records.

**11. [P1] User socket rooms survive logout and account switching**

The subscription cleanup removes listeners but never leaves the user room; logout never disconnects the singleton socket. Switching from User A to User B emitted join_user twice and no leave. New listeners can receive the old account's activity.

Location: [client/src/services/socket.js:50](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/services/socket.js#L50). Verification: **Component/socket probe**. Suggested fix: Disconnect/reset the socket at logout or explicitly leave authenticated rooms; prevent a socket from retaining another user's membership.

**12. [P1] Production can use a publicly known default JWT signing secret**

With NODE_ENV=production and JWT_SECRET unset, configuration still accepts the repository's fixed development secret. In that configuration an attacker who knows a user ID can forge an app token. The audit verified this configuration path, not the deployed site's secret.

Location: [server/src/config/env.js:15](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/config/env.js#L15). Verification: **Configuration probe**. Suggested fix: Fail production startup when JWT_SECRET is absent or equals the development default.

**13. [P2] Interviews can remain incomplete after every generated question is answered**

The session keeps the requested count, while the deterministic bank returns at most four backend or five other questions. A default five-question Backend Engineer session generated four; after all four answers, answeredCount was 4, totalQuestions was 5 and status stayed in_progress. The UI's eight-question option also exceeds both banks.

Location: [server/src/services/interviewService.js:25](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/interviewService.js#L25). Verification: **Runtime**. Suggested fix: Generate the exact supported count or set totalQuestions from the persisted question set; validate count as a bounded positive integer.

**14. [P2] Moving between questions reuses the wrong answer draft**

userAnswer initializes once from props. The parent reuses the same QuestionCard without a question key or state reset. Typing an answer for Q1 and navigating to Q2 showed Q1's answer in Q2 and could submit it under Q2's ID; revisiting questions also loses independent drafts.

Location: [client/src/components/QuestionCard/QuestionCard.js:12](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/components/QuestionCard/QuestionCard.js#L12). Verification: **Component probe**. Suggested fix: Keep drafts keyed by question ID, or remount/reset the card when the question changes.

**15. [P2] Resume-based job-search personalization cannot be triggered**

The jobs page passes onGenerateCustom, but JobRoleCard never calls or exposes it. Rendered cards contain only four default links and no personalization action, so /jobs/search-links is never requested from this UI and selecting a resume changes nothing.

Location: [client/src/components/JobRoleCard/JobRoleCard.js:4](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/components/JobRoleCard/JobRoleCard.js#L4). Verification: **Component probe**. Suggested fix: Wire the callback to an action or generate links automatically when role/resume selection changes.

**16. [P2] Gap analysis adds random requirements and fabricated citations**

Requirements are selected using Math.random even when absent from the JD; supportingResumeLines are template claims rather than extracted resume lines. Controlling randomness for the identical React-only JD produced scores of 95 and 40 and missing TypeScript/Next.js requirements that were never requested.

Location: [server/src/providers/deterministicProvider.js:361](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L361). Verification: **Runtime**. Suggested fix: Derive requirements and citations from the actual inputs, remove randomness, and permit genuine 0–100 match scores.

**17. [P2] Fallback tailoring ignores the supplied job description**

jobDescriptionText is accepted but never used. With the same role/resume, a Rust-required JD and a Python-required JD produced identical tailored content.

Location: [server/src/providers/deterministicProvider.js:279](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L279). Verification: **Provider probe**. Suggested fix: Use actual JD requirements to prioritize only evidence-backed resume content.

**18. [P2] The Data / ML role selects full-stack tailoring keywords**

The map key is data/ml, but the UI sends Data / ML Engineer. The substring comparison does not normalize spaces around the slash, so this supported selection falls back to fullstack and produces React/Next.js/Node.js/TypeScript keywords.

Location: [server/src/providers/deterministicProvider.js:289](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L289). Verification: **Provider probe**. Suggested fix: Use stable role IDs or normalize role labels consistently across client and server.

**19. [P2] Skill extraction misses C++, C# and .NET**

Word-boundary markers around punctuation-bearing skill names prevent valid matches. For 'C++, C#, .NET, React', only React was recognized, affecting scoring, gap analysis and search keywords.

Location: [server/src/providers/deterministicProvider.js:58](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L58). Verification: **Provider probe**. Suggested fix: Use token boundaries that account for leading/trailing punctuation instead of wrapping every skill in word-boundary markers.

**20. [P2] Fallback interviews ignore most role and resume context**

Only backend versus fullstack banks are selected; resumeData is unused. A Python Data / ML candidate and a Product Manager received identical React state-management and Node/database questions. Other advertised non-backend roles also receive the fullstack bank.

Location: [server/src/providers/deterministicProvider.js:501](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/deterministicProvider.js#L501). Verification: **Provider probe**. Suggested fix: Provide role-specific banks and select questions using actual resume skills and supported JD context.

**21. [P2] Invalid provider output bypasses the fallback chain**

Provider success means only that the call did not throw. Returning an empty JSON object was accepted as successful OpenRouter parsing, with no contactInfo or other required fields. Empty question arrays and malformed scores likewise reach consumers or database validation rather than trying the next provider.

Location: [server/src/providers/providerFactory.js:53](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/providers/providerFactory.js#L53). Verification: **Mocked provider**. Suggested fix: Validate action-specific response schemas inside each attempt before accepting the result.

**22. [P2] Tailored ATS scores exclude preserved contact and education**

Scoring receives tailoredData alone, whose schema contains no contactInfo or education. A resume with both sections was reported as missing contact information and received no education structure credit. rawText is also replaced with an empty string, so the fallback assumes a default word count.

Location: [server/src/services/tailoringService.js:47](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/tailoringService.js#L47). Verification: **Runtime**. Suggested fix: Score the complete assembled resume, merging unchanged sections and using its actual text.

**23. [P2] Tailored PDF exports omit education and certifications**

The exporter renders contact, summary, skills, experience and projects only. An exported PDF from a resume containing Actual University and Actual Certificate contained neither. Project descriptions and links are also omitted when they are not represented in highlights.

Location: [server/src/services/tailoringService.js:97](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/tailoringService.js#L97). Verification: **Runtime/PDF extraction**. Suggested fix: Render all relevant preserved sections and project content in the final document.

**24. [P2] Concurrent tailoring creates duplicate version numbers**

Both requests calculate countDocuments + 1 before creating a version. Two concurrent requests for the same resume both saved version 2, making version history ambiguous.

Location: [server/src/services/tailoringService.js:18](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/tailoringService.js#L18). Verification: **Runtime**. Suggested fix: Allocate versions atomically and enforce uniqueness for resumeId plus version.

**25. [P2] Cancelling an active processing job does not stop it**

The cancel endpoint saved CANCELLED, but the running orchestrator continued its work and overwrote the state with COMPLETED. The synchronous runProcessingJob lifecycle reproduced the same problem. The orchestrator checks cancellation only before starting.

Location: [server/src/agents/orchestrator.js:186](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/agents/orchestrator.js#L186). Verification: **Runtime**. Suggested fix: Check cancellation between stages and before persisting output; use conditional status transitions and abortable provider work.

**26. [P2] Failed question generation leaves an unusable interview session**

InterviewSession is created before generation. A controlled generation failure left an in_progress session with zero questions in history; opening it yields Session Not Found because the frontend rejects empty question sets.

Location: [server/src/services/interviewService.js:18](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/interviewService.js#L18). Verification: **Runtime**. Suggested fix: Create the usable session atomically with questions, or mark failures explicitly and clean up partial records.

**27. [P2] The interview API ignores jobDescriptionId when generating questions**

startSession stores jobDescriptionId but never loads or validates that description and never passes its text to generatorAgent.generateQuestions. Supplying the optional JD therefore does not influence the interview, even with a remote AI provider.

Location: [server/src/services/interviewService.js:47](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/interviewService.js#L47). Verification: **Source**. Suggested fix: Load an owned JobDescription, verify access and pass its rawText to question generation.

**28. [P2] Upload timelines lose fast events and stop listening too early**

The job starts before the upload response, but the client subscribes only afterward and never loads saved logs. Fast fallback events may already be gone. The subscription is also forcibly removed after 30 seconds, although parsing and scoring can together consume four 15-second provider attempts before fallback.

Location: [client/src/components/ResumeUploadDropzone/ResumeUploadDropzone.js:59](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/components/ResumeUploadDropzone/ResumeUploadDropzone.js#L59). Verification: **Source**. Suggested fix: Fetch the persisted timeline/status when subscribing and stay subscribed until a terminal job state, with component cleanup.

**29. [P2] Upload processing state reports completion before the job is complete**

isProcessing is cleared on parse_completed before ATS evaluation and the final resume save. The success panel is shown immediately after the initial 202 response and claims the resume is ready. Failure/cancellation events never clear the running state or present a failed result.

Location: [client/src/pages/resume/upload.js:16](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/pages/resume/upload.js#L16). Verification: **Source**. Suggested fix: Drive readiness and failure UI from persisted terminal job status, and reset per-upload state.

**30. [P2] Resume details stay empty or stale after background parsing completes**

The details page fetches the resume once and never polls or subscribes for completion. Following View Detail immediately after upload can leave empty parsed content and a zero ATS score displayed indefinitely; tailoring and interviews can also be started from this unready resume.

Location: [client/src/pages/resume/[id]/index.js:37](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/pages/resume/%5Bid%5D/index.js#L37). Verification: **Source**. Suggested fix: Refresh on job completion and gate dependent actions until parsing succeeds.

**31. [P2] Weekly application analytics merge different months**

The bucket key uses year and ceil(day-of-month / 7), omitting the month. Applications on January 2 and February 2, 2026 collapsed into one 2026-W1 bucket instead of separate calendar weeks.

Location: [server/src/services/applicationService.js:109](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/applicationService.js#L109). Verification: **Runtime**. Suggested fix: Bucket by an actual week-start date or a correct ISO week-year/week number.

**32. [P2] Application funnel conversion loses past successful stages**

Conversion rates use current status only and ignore the existing timeline. Moving an application from interview to rejected erased its reached-interview contribution and dropped the demonstrated applied-to-OA rate from 100% to 0%. Rejection should not erase stages already reached.

Location: [server/src/services/applicationService.js:93](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/applicationService.js#L93). Verification: **Runtime**. Suggested fix: Compute stage progression from historical timeline events, with explicit rules for skipped stages.

**33. [P2] Application dates cannot be corrected and remain bookmark dates**

updateApplication ignores appliedDate. A request to change January 1 to August 1 returned the unchanged January date. createApplication also assigns an applied date to saved/bookmarked records, and changing status to applied never updates it, skewing application-date reporting.

Location: [server/src/services/applicationService.js:57](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/applicationService.js#L57). Verification: **Runtime plus source**. Suggested fix: Accept validated date corrections and distinguish savedAt from the actual appliedDate.

**34. [P2] Failed application saves discard the user's edits**

handleSaveModal starts the asynchronous save and closes the modal immediately. The page catches failures only with console.error. Reopening the modal resets its form, so a failed create/update can silently lose everything entered, and double submissions are not prevented.

Location: [client/src/components/ApplicationBoard/ApplicationBoard.js:33](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/components/ApplicationBoard/ApplicationBoard.js#L33). Verification: **Source**. Suggested fix: Await save success before closing; retain form state and show request errors while disabling duplicate submissions.

**35. [P2] The dashboard's recent records return the oldest records**

Resume and application queries are unsorted, then sliced from index zero. After creating seven resumes, the recent list contained the first five and excluded the newest upload; applications have the same query pattern.

Location: [server/src/services/resumeService.js:81](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/resumeService.js#L81). Verification: **Runtime**. Suggested fix: Sort by createdAt or the intended activity timestamp descending before applying a database limit.

**36. [P2] Saved profile changes are not reflected in the app session**

The profile request succeeds, but its returned user is discarded. Neither the auth store nor persisted user snapshot is updated, so the navbar, dashboard name and target-role preference remain stale until session reinitialization.

Location: [client/src/pages/settings.js:34](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/pages/settings.js#L34). Verification: **Source**. Suggested fix: Write the returned profile into the auth store and persisted session after saving; display failures in the settings UI.

**37. [P2] A temporary backend/network failure logs users out**

initialize deletes the valid stored session on every /auth/me error, including a transient network outage or server failure. The probe reproduced loss of both authentication state and localStorage without a 401 or 403.

Location: [client/src/store/authStore.js:24](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/store/authStore.js#L24). Verification: **Store probe**. Suggested fix: Invalidate a session only for authentication rejection; preserve it and provide retry/degraded state for transient failures.

**38. [P2] Socket subscriptions stop working after reconnection**

User/job rooms are joined only when a subscription is created. A reconnected socket has lost its server-side memberships, but the connect handler only logs a message. Simulating reconnect produced no new join events.

Location: [client/src/services/socket.js:18](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/services/socket.js#L18). Verification: **Socket probe**. Suggested fix: Track active subscriptions and rejoin their authorized rooms on each connection.

**39. [P2] Notifications do not update in real time**

The drawer fetches only when isOpen changes. It never subscribes to notification events, so new activity while the drawer stays open does not appear despite its real-time UI promise; the bell's unread indicator is also unconditional.

Location: [client/src/components/AppShell/NotificationsDrawer.js:21](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/src/components/AppShell/NotificationsDrawer.js#L21). Verification: **Source**. Suggested fix: Subscribe for the authenticated session and update the drawer/unread count when notifications arrive or are marked read.

**40. [P2] Deleting a resume leaves originals and private derived data behind**

Deletion removes the Resume and tailored versions only. The isolated test retained six related processing jobs containing resume inputs, a gap analysis and two interview sessions; ProcessingLogs, questions and job descriptions are not handled either. Local/Cloudinary originals are never deleted, and local files remain publicly fetchable.

Location: [server/src/services/resumeService.js:26](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/resumeService.js#L26). Verification: **Runtime plus source**. Suggested fix: Define and implement appropriate cascading cleanup or explicit retention behavior, including original files and in-flight jobs.

**41. [P2] The in-memory queue leaks every completed job**

Every dispatch inserts an entry into this.jobs. Entries are never updated or removed after completion/failure, so the default fallback queue retains an unbounded number of jobs for the process lifetime. Three completed synthetic jobs left three entries.

Location: [server/src/queues/processingQueue.js:16](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/queues/processingQueue.js#L16). Verification: **Queue probe**. Suggested fix: Delete completed entries or keep bounded retained history with terminal statuses.

**42. [P2] Redis URLs silently ignore the selected logical database**

Manual URL parsing copies host/port/username/password/TLS but drops the pathname. A redis://.../5 configuration created connection options without db, selecting database 0 instead and risking queue collisions with another environment using the same queue name.

Location: [server/src/queues/processingQueue.js:41](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/queues/processingQueue.js#L41). Verification: **Configuration probe**. Suggested fix: Parse and validate the database index or pass the supported URL through to the Redis client.

**43. [P2] A configured MongoDB outage has no promised fallback**

The memory server is attempted only when MONGODB_URI is empty. If a configured URI fails, connectDB catches and suppresses the error and the HTTP server starts with no usable database. A connection-failure probe confirmed no memory fallback and no propagated startup error.

Location: [server/src/config/db.js:10](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/config/db.js#L10). Verification: **Mocked connection**. Suggested fix: Use an explicit development fallback policy; fail production startup/readiness when its required database is unavailable.

**44. [P2] Health checks return healthy while the database is disconnected**

After disconnecting MongoDB, GET /api/health still returned HTTP 200 and status: healthy alongside database.status: disconnected. Deployment checks can route traffic to an instance whose authenticated features cannot work.

Location: [server/src/routes/healthRoutes.js:12](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/routes/healthRoutes.js#L12). Verification: **Runtime**. Suggested fix: Separate liveness from readiness and return an unhealthy/non-ready status when required dependencies are down.

**45. [P2] CORS accepts every origin with credentials enabled**

Both branches call callback(null, true), so the configured CLIENT_URL restriction has no effect. A request from an arbitrary untrusted origin received that origin in Access-Control-Allow-Origin plus Allow-Credentials: true. This does not alone bypass bearer-token auth, but the intended origin control is absent.

Location: [server/src/app.js:34](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/app.js#L34). Verification: **Runtime**. Suggested fix: Use an exact allowlist with environment-specific local development exceptions and reject other origins.

**46. [P2] Firebase auth and expensive AI actions have no rate limits**

The only limiter mounts protect /auth/login and /auth/register. /auth/firebase is excluded, and upload, tailoring, gap analysis, question generation and answer evaluation have no quotas or generation limiter despite the code/spec stating otherwise.

Location: [server/src/app.js:62](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/app.js#L62). Verification: **Source**. Suggested fix: Apply appropriate IP/account rate limits and per-user quotas to the Firebase exchange and costly processing endpoints.

**47. [P2] Most AI actions do not use the background queue or expose early job status**

Tailoring, gap analysis, interview creation and answer evaluation run inline in their HTTP requests. Their controllers wait for the complete AI work before returning jobId/results, so clients cannot obtain the promised queued job handle for progress/cancellation and slow provider chains keep the request open.

Location: [server/src/services/processingJobLifecycle.js:26](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/services/processingJobLifecycle.js#L26). Verification: **Source**. Suggested fix: Enqueue these workflows, return an accepted job handle promptly, and persist their outputs in the worker.

**48. [P2] Graceful shutdown can hang while WebSocket clients remain connected**

shutdown calls server.close and waits for its callback before exiting, but never closes Socket.IO/upgraded connections. A local equivalent with a connected WebSocket did not complete server.close until the socket was disconnected; there is no shutdown deadline or worker/database cleanup.

Location: [server/src/server.js:40](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/server.js#L40). Verification: **Runtime socket probe**. Suggested fix: Close Socket.IO and background workers/connections explicitly, drain work appropriately, and enforce a bounded shutdown deadline.

**49. [P2] The upload API accepts unsupported legacy .doc files**

The filter accepts .doc, but parserAgent routes it to Mammoth's DOCX reader; legacy Word binary documents are not DOCX. resumeService also records this accepted type as pdf. A filter probe confirmed acceptance, so unsupported files can be stored and queued before failing.

Location: [server/src/middlewares/upload.js:8](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/middlewares/upload.js#L8). Verification: **Filter probe plus source**. Suggested fix: Reject .doc consistently or add a real legacy Word converter and an accurate stored file type.

**50. [P2] Invalid file types return a server error instead of a validation error**

The file filter constructs a generic Error without a client status. errorHandler defaults it to 500. A synthetic resume.html rejection produced HTTP 500 even though this is invalid client input.

Location: [server/src/middlewares/upload.js:15](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/src/middlewares/upload.js#L15). Verification: **Middleware probe**. Suggested fix: Assign a suitable 400/415 status/code and handle upload validation errors consistently.

**51. [P2] The documented backend test command cannot run**

npm --prefix server test executes node test/api.test.js, but that file does not exist. It fails with MODULE_NOT_FOUND and does not run the existing Firebase test.

Location: [server/package.json:9](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/server/package.json#L9). Verification: **Repository command**. Suggested fix: Point the script at the maintained test suite, such as node --test test/*.test.js, and add meaningful integration coverage.

**52. [P2] The frontend lint command is incompatible with installed Next.js**

npm --prefix client run lint executes next lint. Installed Next.js 16.3.3 treats lint as a project directory and exits with 'Invalid project directory .../client/lint'; no working lint configuration/dependency is provided.

Location: [client/package.json:10](https://github.com/darekarbro/Agentic-AI-Automation/blob/4a9078cda2672d0a0d90530c92f5ebb0b4e02770/client/package.json#L10). Verification: **Repository command**. Suggested fix: Configure a supported ESLint command/configuration and update the package script.

**Verification limits**

Live Google/Firebase sign-in, paid AI-provider calls, Cloudinary operations, Redis-server behavior, deployed reverse-proxy configuration, third-party job-board navigation and visual/browser interaction were not tested end to end. Conditions such as a missing production JWT secret or an enabled unverified-email Firebase provider are explicitly conditional findings, not assertions about the live deployment. Dependency advisories were not queried. This report lists every issue found during this audit; a source review and targeted probes cannot prove that no other bugs exist.

Suggested repair order: account and data-isolation issues (02–07, 10–12), registration (01), fabricated resume data (08–09), then interview completion and editing (13–14), followed by processing reliability and the remaining P2 findings. Repair the two repository check commands early so fixes can be verified continuously.
