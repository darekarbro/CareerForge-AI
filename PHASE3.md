# Phase 3: evidence-backed resume copilot

Completed on 31 October 2026. Review branch `Phase-3`, based on `Phase-2`. No merge is part of this work.

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

## Validation

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

Automated accessibility audits are not a complete conformance assessment. Factual checks and lexical citations cannot prove every claim's meaning, authorship or causality. Review is still required. GitHub public quotas, source limits and durable record retention are described in the [workflow guide](docs/PHASE3_WORKFLOWS.md). Existing upstream moderate dependency findings remain documented in the [audit](docs/DEPENDENCY_AUDIT.md).

GitHub application and container checks run again on the pushed review head. The branch is intended for manual review and remains unmerged.
