# Phase 1: dependable public release

Builds on the Improvement branch. Keep this work separate for review; do not merge automatically.

## Release checklist

- [x] Pull-request CI runs API/component tests, lint, production build and browser acceptance; retains failure artifacts.
- [x] Docker setup runs frontend, API, independent worker, MongoDB, Redis and a local email inbox with persistent volumes and health checks.
- [x] Local accounts support email verification and password recovery with expiring, single-use tokens.
- [x] Sessions expire clearly and can be revoked across devices, including connected sockets.
- [x] Users can export account data, request complete deletion and control retention and AI-provider sharing.
- [x] OpenAPI, architecture/data relationships, job lifecycle and deployment/runbook documentation are complete.
- [x] Complete automated, browser, deployment and relevant AI regression checks pass before commit/push.

## Validation record

Validated on 27 October 2026 with Node 24:

| Check | Result |
| --- | --- |
| Backend | 70 tests passed, including OpenAPI validation and complete route coverage; account recovery, ownership, sessions, privacy, deletion, retention, Google reauthentication and existing AI/domain regressions. |
| Frontend | 19 component/state tests passed; ESLint passed with zero warnings. |
| Production build | All 27 pages built successfully, including recovery, verification and account/privacy pages. |
| Browser acceptance | 12 groups passed against a production build using real Chrome, isolated MongoDB and fictional accounts; desktop/mobile editing, jobs, exports, interviews, recovery, privacy and deletion. Mobile account screenshot inspected. Screenshots, trace and report are generated under ignored .test-tmp. |
| Containers | Six services built and healthy. SMTP verification/recovery used Mailpit; a separate worker published Redis socket events. With the worker stopped, a newly accepted job remained PENDING; it completed after restart. During a Redis outage, the API stayed available and MongoDB-backed recovery completed new work. Account sessions, records and private originals survived API restart. ZIP export and background account deletion completed. |
| Groq | All six AI actions passed with fallback disabled; scoped rewrite, answer retry, usage, timeline and notification checks passed. 11 real requests, 12 acceptance checks, fictional data only. |
| Dependencies | Production audits for server and client reported zero vulnerabilities. |

The new account verification and provider consent settings are deliberate upgrade changes: existing sessions require a fresh sign-in, local users must verify email before AI processing, and external sharing starts off. Production needs configured SMTP and persistent shared storage. See docs/DEPLOYMENT.md and docs/RUNBOOK.md for rollout, backup and third-party retention limits.

The Docker readiness run caught and fixed a Redis adapter subscription race before acceptance passed. Tests use isolated databases, fictional accounts and local email capture. Real environment files, uploads, generated archives, browser traces and local Docker secrets remain untracked. No production deployment or merge is part of this phase.

GitHub's application and container CI jobs also passed on draft PR #3. The workflow uses reviewed commit pins for the Node 24 action runtimes and an explicit Ubuntu 24.04 runner to avoid runtime deprecation and runner-image migration warnings.
