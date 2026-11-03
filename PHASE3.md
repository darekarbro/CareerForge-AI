# Phase 3: evidence-backed resume copilot

Initial delivery completed on 31 October 2026 on `Phase-3`, based on `Phase-2`. Phase 3 has since reached `main`. The current readiness fixes are reviewed in [PR #10](https://github.com/darekarbro/CareerForge-AI/pull/10); no merge or hosted deployment is part of this review.

- [x] Structured career evidence with stable IDs, revisions, verification and measurement states.
- [x] Inspectable evidence IDs, source passages and current verification for rewritten resume claims.
- [x] Targeted personal-contribution and measurement questions; unknown outcomes stay empty.
- [x] Controlled GitHub and project-document imports with preview, selection and explicit confirmation.
- [x] Owner-scoped structured retrieval with relevance reasons and bounded results.
- [x] Entry-specific checks for quantities, technologies, implementation methods and responsibilities.
- [x] Bounded, inspectable planning: clarify, retrieve, rewrite, validate and recommend review.
- [x] Full local regression, browser/accessibility, container and live AI validation.

## Delivered behavior

The evidence library supports achievements, responsibilities, projects and skills. Collection preserves fact IDs across reordering and never resets a user's verification decision or edited statement. Context includes the source record and entry ID, preventing legacy entry-ID collisions from lending one project's facts to another. Confirmed project imports retain their original passages and require a deliberate personal-contribution assertion, including review of suggested repository technologies.

The copilot freezes the selected resume/workspace inputs, retrieves confirmed evidence, asks targeted questions when detail is missing and can continue once. Skipped answers remain empty. Insufficient confirmed contribution ends in a review recommendation without invented outcomes. A sufficient source produces a separate whole-resume, summary or single-entry draft. The original profile/resume remains unchanged. Reopened active runs follow their persisted jobs through completion.

At most eight recorded planning steps span the initial and continued run. The application uses conditional planning rules, one logical rewrite and one quality assessment. It does not expose arbitrary tools or an open-ended model loop. Provider fallback, format repair and a single Groq factual correction can involve additional HTTP requests; replacement wording must still pass validation. Reported token usage includes successful correction responses within the provider attempt.

Generated claims are checked against their own entry and receive inspectable citations. Known unsupported wording is replaced with source wording or omitted and recorded as withheld. Rechecking uses current verification: rejected, archived, edited or moved facts can no longer serve as the same confirmed citation. Manual edits are flagged for review rather than silently rewritten. Legacy versions can collect evidence explicitly.

GitHub ownership and individual contribution are user attested, not externally verified. Document previews are extracted locally and public repository previews use bounded GitHub API reads; preview text is not sent to AI. Structured retrieval is sufficient at the bounded library size, so this phase introduces no vector database or embedding service.

## Initial delivery validation

Career test data is fictional and isolated. The optional live GitHub check previewed this public repository and discarded it without sending its README to AI. Real keys, environment files, temporary databases and generated test evidence remain excluded from Git.

| Check | Result |
| --- | --- |
| Complete backend suite | 93 passed, 0 failed/skipped |
| Complete frontend suite | 34 passed, 0 failed/skipped |
| ESLint | Passed, 0 warnings |
| Production Webpack build | All 29 pages built |
| Full browser acceptance | 22 workflow groups passed |
| axe WCAG 2.0/2.1 A/AA checks | 39 audits, 0 violations |
| Mobile and visual inspection | New library/copilot screens fit 390 px; desktop/mobile screenshots inspected |
| PDF/DOCX regression | Existing layouts, Unicode and late sections preserved; live copilot PDF exported and extracted |
| Docker Compose | All six services healthy; all six acceptance groups passed |
| Worker and restart recovery | Queuing with worker stopped, persisted copilot result, API restart and Redis outage passed |
| Live Groq | All 6 distinct actions plus the copilot; 13 successful logical actions, 14 real requests, 16 checks; fallback disabled |
| Live request recovery | 13 HTTP 200 responses; 1 Groq JSON-format HTTP 400 corrected within the bounded format retry |
| Live project import | Public GitHub metadata/README/languages preview passed and was discarded without AI sharing |
| OpenAPI contract | Valid schema, all 104 mounted operations documented |
| Dependency audit | Client production 0; client including development 6 moderate; server production 6 moderate; server including development 7 moderate; no high/critical |
| Secret and whitespace checks | No configured credentials in changed source; diff check passed |

Regression coverage includes cross-account ownership, stable/rejected evidence after entry reordering, collisions between source records, selective imports, instruction-like passage rejection, skipped answers, stale workspace conflicts before saving clarification facts, bounded traces, persisted-result recovery, citation revocation and complete export/deletion of the new collections. Browser acceptance also retains the full account, profile, workspace, application and interview journeys. CI retains browser screenshots and audit evidence for seven days.

Diagnostic live runs exposed entry-specific factual drift and synthetic quota waits exceeding the runner's provider deadline. The factual correction preserves the validator's rejection rules. Acceptance-only pacing now gives its artificial waits a longer test deadline; application deadlines are unchanged. One fixture also required explicit confirmation of facts collected before source verification, exercising the intended preservation of verification decisions.

Automated accessibility audits are not a complete conformance assessment. Factual checks and lexical citations cannot prove every claim's meaning, authorship or causality. Review is still required. GitHub public quotas, source limits and durable record retention are described in the [workflow guide](docs/PHASE3_WORKFLOWS.md). The dependency findings from the initial delivery were subsequently resolved; current results are in the [audit](docs/DEPENDENCY_AUDIT.md).

## Readiness follow-up — 3 November 2026

The review found and fixed additional failure and concurrency paths:

- Interrupted project imports retain a durable confirmation manifest, resume after a restart/reload, tolerate retries without duplicate facts, and remain excluded from retrieval/citations until complete. Account archives retain pending choices.
- Citation refresh invalidates edited technologies/measurement context and removes revoked support from historical withheld suggestions.
- Historical or enriched version content cannot inherit verification from a different current source; removed source facts stay out of new copilot retrieval while library history is preserved.
- Queued copilot runs recheck source/workspace revisions before processing and before committing a draft. Changed inputs end in a visible review recommendation, with no stale draft saved.
- Clarification capacity is checked before pending answers are consumed. Failed background jobs show their terminal state. Leaving a copilot page stops its waiter without cancelling work or redirecting back later.
- PDF/DOCX parsing has worker heap/time bounds, bounded concurrency/waiting and ZIP expansion checks; malformed UTF-8 and oversized text are rejected. Valid PDF, DOCX and Unicode export regressions remain covered.
- Node 24 is explicit for hosting. A read-only deployment preflight verifies Phase 3 routes, auth guards and worker/database readiness, and runs against Compose in CI.

Current local validation: **129 backend tests, 39 frontend tests, lint with zero warnings, all 29 production pages, 24 browser workflow groups and 42 WCAG A/AA audits passed, with zero accessibility violations.** Full and production-only dependency audits report zero vulnerabilities in both trees. No tests were skipped.

Rebuilt API, worker and frontend images passed all six Compose acceptance groups, including interrupted dependencies, persisted jobs, SMTP, exports and deletion. All seven deployment preflight checks passed against this rebuilt stack. Live Groq passed 16 checks using 14 real requests across all six AI actions and the scoped evidence copilot, with fallback disabled; the public GitHub import preview was also tested and discarded without AI sharing. Exact-head CI results are available on PR #10. Test career data is fictional and private environment files remain excluded from Git.

The public Render backend currently answers health but returns 404 for the Phase 3 API contract and copilot route. It must be deployed from the reviewed code along with the matching worker before the live frontend can use Phase 3. See [deployment instructions and the preflight command](docs/DEPLOYMENT.md). Passing repository checks is distinct from verifying the existing hosted service.
