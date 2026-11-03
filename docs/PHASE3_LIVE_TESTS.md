# Phase 3 live deployment and acceptance

Checked on 3–4 November 2026. The frontend is `https://careerforge-ai-three-eta.vercel.app`; the API is `https://careerforge-backend-mg0r.onrender.com/api`.

## Deployment repair

Render had successfully built recent commits but rejected startup because its production signing secret did not satisfy the existing security requirement. It retained the last live August commit, explaining healthy responses from an API without Phase 3 routes. Replacing the invalid signing secret was explicitly approved, generated securely and applied only to the intended service. The existing Groq key was added to that service with separate approval. No secret values are recorded here, and no paid resources were provisioned.

Render deployment `dep-dbl24fs9v7es73dafec0` and Vercel production deployment `dpl_J6yYtJ4bZEjvR9RMrd7mpbK7uRor` were verified against merged revision `bf83ed336aaa92770b0a71b0b5b0eaf321052063`. Render continues using its existing combined API/worker process with Redis. PR #10 was merged by the repository owner during testing; the subsequent outcome-validation fix is on a separate review branch.

## Verified on the hosted application

Only separately labelled fictional career records were created. The existing account's other resume and profile were not edited or sent to AI. Groq-only account sharing was saved using the prior authorization for Groq; OpenRouter and Gemini remained off for this account.

| Workflow | Evidence/result |
| --- | --- |
| Public release preflight | All seven health, contract, authentication and frontend-route checks passed |
| Browser/API connection | Production-origin CORS passed; live OpenAPI validated with 104 operations |
| Fictional resume upload | Completed; both structural parsing and assessment traces reported Groq |
| Source editing and verification | Named verification revision survived a full reload |
| Evidence collection | Confirmed source facts collected; repeating collection preserved the inventory without duplicates |
| Manual evidence and retrieval | A separately confirmed fact was retrieved, then excluded after rejection |
| TXT project import | Source preview, one selected passage, personal-contribution confirmation and persisted imported fact passed |
| PDF/DOCX project preview | Both formats extracted the fictional source text; unused previews were discarded |
| Scoped copilot | Targeted contribution questions persisted after reload; unknown outcome stayed blank; one continuation produced a draft with eight recorded steps |
| Actual AI attribution | Copilot rewrite and assessment traces both reported Groq; activity showed zero offline responses for the test requests |
| Source preservation | Original project description and empty highlights stayed unchanged; the other project retained its complete original description |
| Citation review | Supporting contribution, source quote, revision and unknown measurement were visible; rejecting the test fact removed its citation from the saved draft, then its confirmation was restored |
| Review and export | Saved conservative review choices persisted; real PDF preview and PDF/DOCX downloads retained both projects, education and the confirmed contribution |
| Export contents | Downloaded PDF and DOCX were parsed independently; unsupported rejected wording was absent and the PDF contained one page |
| Mobile | Copilot and evidence library fit a 390 px viewport without horizontal content overflow |

## Live-discovered wording fix

The source described validation checks and recovery instructions, with no observed outcome. A generated draft nevertheless said it had streamlined imports and reduced data errors. The test draft was reviewed conservatively, keeping its source wording.

The follow-up adds shared outcome support checks to provider validation and claim withholding. Effects must have matching family and target support in the same entry. Unknown, negated, unverified and intended benefits cannot authorize a positive result. Four regressions cover the observed failure, bounded Groq factual correction, supported effects and cross-project borrowing. This is a conservative lexical guard, not a proof of semantic truth. Historical drafts remain editable; refreshed evidence reports can flag unsupported wording without silently rewriting saved records.

Validation of the follow-up: 133 backend tests and 39 frontend tests passed with no skips; lint passed with zero warnings; all 29 pages built; 24 browser workflow groups and 42 WCAG A/AA audits passed with zero violations. Rebuilt images passed all six Compose acceptance groups and all seven local preflight checks. All four dependency audit scopes report zero vulnerabilities.

## Remaining live acceptance

- The follow-up outcome guard must be committed, reviewed and deployed before its behavior can be claimed for production. Repeat a scoped run after that deployment, then complete summary-only, whole-resume and workspace-selection live checks.
- GitHub preview returned the provider's rate-limit/access-restriction response from Render on both attempts. The user chose to retain unauthenticated GitHub imports, so this remains an external quota constraint; document imports are available. No GitHub token support or credential was added.
- Forced partial writes, dependency outages and destructive account deletion were exercised in isolated local/CI tests, not injected into production. The signed-in account contains existing records, so a destructive full-account test was not performed on it.

Local screenshots, fictional fixtures and downloaded export inspections remain in ignored `.test-tmp` files. Production session tokens, keys and private account archives are excluded from the repository.
