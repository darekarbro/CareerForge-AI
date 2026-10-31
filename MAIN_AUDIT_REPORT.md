# Main branch audit — 31 October 2026

Reviewed main at `703feeda6862170dbedf8e81201266f079de28cc`. Fixes are on `codex/main-audit-fixes` for review; main is not modified or merged.

The review covered authentication, sessions and sockets, ownership checks, asynchronous jobs, storage and privacy, resume editing and generation, evidence retrieval, interview practice, applications, API documentation, deployment configuration and frontend workflows. The baseline backend suite passed 93 tests; the issues below required additional regression coverage. This is a code and workflow audit, not a guarantee that no undiscovered vulnerabilities remain.

## Findings and fixes

| Priority | Finding | Result after the fix |
| --- | --- | --- |
| High | An attacker could pre-register an email locally and retain their password and sessions after its owner signed in through Google. | Verified Google ownership of an unverified local account atomically replaces its password, revokes tokens/sessions and links the verified identity. Established verified local accounts retain their login method. |
| High | A password change already in flight could overwrite newer credential state after another security action. | Password changes compare the current hash and credential version atomically; stale writes fail with `SESSION_CHANGED`. |
| High | Privacy exports/deletion could continue using credentials superseded during reauthentication or archive preparation. | Privacy actions recheck the credential version. Deletion records carry their authorization version, and both the request and recovery worker reject stale requests before disabling or deleting the account. |
| Medium | Malformed authentication field types caused server errors, and registration names/roles were unbounded. | Routes and services reject invalid types and excessive lengths with client errors. Legacy short passwords can still sign in. |
| Medium | Private API responses did not consistently forbid caching. | All `/api` responses carry `private, no-store`, including authentication and error responses. |
| Medium | Summary-only copilot runs could add confirmed evidence to unrelated experience/project sections. | Scoped composition preserves the original snapshot outside the selected scope, including the source used for review. |
| Medium | Identical entry IDs in different resume sections could share retrieval or verification decisions. | Evidence selection and source verification match section and entry ID together within the owned resume. |
| Medium | Optional clarification questions could crowd required questions out of the eight-question limit. | Required contribution questions are presented first; additional missing required facts still prevent unsafe generation. |
| Medium | Skills present only in the complete `skills.all` list were omitted from evidence. | Evidence includes uncategorized skills and deduplicates normalized aliases. |
| Medium | Exhausted worker retries or expired recovery payloads left answer locks and uploaded resumes stuck running. | Terminal recovery failures release only the matching job's lock and mark only the matching unfinished upload failed. |
| Medium | Delayed interview feedback leaked through session aggregates, job outputs, activity logs, analytics and workspace details. | Shared serializers hide feedback until completion, including legacy outputs/logs. New live evaluation events omit numeric feedback while it is deferred. |
| Medium | A configured cloud-storage failure silently fell back to ephemeral production storage. | Production returns a generic retryable 503 without writing a local original; protected development fallback remains available. |
| Low | Bare job links were validated but their normalized URLs were discarded. | Applications store canonical HTTPS URLs on creation and update. |
| Low | Impossible calendar dates and non-string values were accepted as application dates. | Date fields accept valid ISO dates/timestamps and reject impossible dates or unexpected types. |
| Low | Moving, unlinking or deleting an application left obsolete workspace references. | Owned workspace pointers are cleared and the selected workspace is synchronized. |

Regression coverage is in `server/test/mainAudit.test.js`, `server/test/mainAuditCases.cjs` and the existing browser journey. The browser runner now identifies each accessibility scan and fails a scan after 45 seconds instead of hanging indefinitely. Container readiness and inbox fetches also have explicit network deadlines.

## Validation

- Backend: 108 tests passed, including 15 new audit regressions; no skipped tests.
- Frontend: 34 tests passed.
- Lint: passed with zero warnings.
- Production frontend build: all 29 pages generated.
- Browser: 23 workflow groups and 41 WCAG A/AA accessibility audits passed with zero violations.
- Container images: API, worker and production frontend built successfully.

All six container acceptance groups passed: separate worker/SMTP/private upload/socket events; profile/history/Unicode PDF; scoped evidence copilot/citations; paused-worker/restart persistence; Redis outage recovery; password recovery/archive/background deletion. The final backend and container runs include the privacy credential-version guard. Local Docker engine/port-forwarding errors interrupted two attempts; recreating only the affected test containers restored connectivity, and the final run passed. Persistent volumes were preserved.

Live Groq (`openai/gpt-oss-120b`): all 15 acceptance checks passed using 15 real requests across parsing, ATS scoring, tailoring, gap analysis, question generation and answer evaluation. This also exercised scoped copilot clarification, evidence citations, source preservation and PDF export with fallback disabled. Test accounts, documents and career data are fictional. External providers are disabled in deterministic suites.

## Remaining dependency findings

Fresh npm audits report zero client production advisories, six moderate client development findings, six moderate server production findings and seven moderate server findings including development tools. These are affected dependency paths for the minimatch/glob advisories, not that many independent underlying vulnerabilities. No high or critical advisories were reported.

A non-forced server fix dry run changed no packages. npm's proposed incompatible downgrades and unverified major-version overrides were not applied. See [the dependency audit](docs/DEPENDENCY_AUDIT.md) for affected paths, primary advisory links and follow-up requirements. Those upstream compatibility findings remain open.

Hosted Render logs and live production configuration were not changed by this audit. Local and CI deployment checks validate the repository configuration; they do not prove the hosted backend is running this revision.
