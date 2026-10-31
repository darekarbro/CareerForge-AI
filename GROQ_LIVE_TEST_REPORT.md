# Groq live acceptance results

## Phase 3 revalidation - 31 October 2026

The full live acceptance run passed with `openai/gpt-oss-120b`: all six distinct actions and the new evidence-backed copilot, **13 successful logical actions, 14 real HTTP requests and 16 checks**, with fallback disabled. Thirteen requests returned HTTP 200; one question-generation JSON-format HTTP 400 was repaired by the existing single bounded retry. Every final action passed validation.

The copilot first requested personal-contribution clarification without calling AI. After explicitly confirming the fictional source facts and known contribution, it produced a single-entry draft with an eight-step trace, inspectable citations, skipped unknown outcomes and an unchanged source resume. Its PDF retained the new project and the remaining qualifications. A separate live preview fetched this public GitHub repository's metadata, README and languages, then discarded the preview without AI sharing.

Diagnostic runs showed Groq moving a globally listed technology into an unsupported experience entry. The provider now gets one bounded factual correction; a second unsupported result still fails validation and falls back only to an allowed provider. Correction usage is accumulated when token counts are supplied. Account consent and existing provider input limits remain in force.

Quota pacing applies to physical correction requests as well as actions. The acceptance runner uses a 120-second provider deadline and a five-minute job wait to accommodate its artificial quota pauses; application configuration is unchanged. Live success demonstrates these workflows within the configured provider quota, not unrestricted concurrency. See [Phase 3 validation](PHASE3.md) for complete project results and [the workflow guide](docs/PHASE3_WORKFLOWS.md) for reproduction.

## Phase 2 revalidation — 31 October 2026

The complete acceptance run passed again with `openai/gpt-oss-120b`: all six AI actions, **11 real HTTP 200 requests and 12 checks**, with other providers and offline fallback disabled. It also checked scoped project rewriting, improved-answer retry, token usage, saved timelines and notifications. Inputs were fictional and used an isolated database.

Earlier diagnostic runs exposed a malformed model response and the account's token-per-minute limit. The provider now makes one bounded repair attempt for Groq JSON parsing/validation errors under its original deadline and cancellation signal. The acceptance runner reserves more quota between actions; it does not count a fallback result as success. The final complete run required no failed requests. See [Phase 2 validation](PHASE2.md) for project-wide results.

## Earlier acceptance run

Completed 26 October 2026 using the key configured in server/.env and **openai/gpt-oss-120b**.

**All six AI actions passed against the real Groq API.** Other providers and the offline engine were disabled in the acceptance runner, so no fallback result could count as a pass.

| Feature | Result | Checked |
| --- | --- | --- |
| Resume parsing | Passed | Real Groq response, expected candidate facts, saved structured resume and completed upload job |
| ATS scoring | Passed | Baseline and tailored scores, validated breakdowns and retrieval from the API |
| Resume tailoring | Passed | Role/JD input, saved version, retained education and no added skills |
| JD gap analysis | Passed | Saved report, valid match score and missing Docker/Kubernetes requirements |
| Interview generation | Passed | Three distinct questions, suggested answers and an owned JD-linked session |
| Answer evaluation | Passed | Three real evaluations, persisted feedback/scores and completed session |

The complete workflow made **9 successful Groq requests**, covering all six distinct actions and seven background jobs. A separate PDF upload round trip made **2 further successful Groq requests**. All 11 requests in these completed acceptance runs returned HTTP 200 and identified openai/gpt-oss-120b. They used 21,628 tokens in total. Individual HTTP requests took approximately 1.3–3.4 seconds; this excludes quota pacing and local processing. Initial smoke/diagnostic calls are outside these completed-run totals.

The tests also checked authenticated provider selection, saved version retrieval, PDF download, completion timelines and notifications. Requests were paced when the account's remaining token quota was low. These results demonstrate the tested workflows within that quota, rather than unrestricted concurrent load.

## Additional issue found and fixed

The exported PDF was valid in Poppler and strict pypdf validation, and rendered correctly. However, the legacy JavaScript PDF reader rejected a shared Node Buffer with a bad XRef entry error. That could also prevent uploading a downloaded resume.

The production parser now supplies an independent Uint8Array to PDF.js. A regression test covers a valid PDF stored in a shared Buffer view. The same Groq-generated PDF was then uploaded through the actual API: extraction, Groq parsing, ATS scoring and persistence all passed. The integration PDF assertions now use this production extraction path.

After this fix, **42 backend tests and 10 frontend tests passed**, with no failures or skipped tests.

## Scope and reproduction

- Only a fictional candidate, fictional employers and example.test addresses were sent to Groq.
- Each run used its own temporary MongoDB, localhost API server and local test upload. Existing user records, configured MongoDB/Redis/Cloudinary/Firebase services and other AI providers were not used.
- Cleanup completed without errors. The API key was neither printed nor written into reports, and server/.env was not edited by the test.
- These were backend/API acceptance checks, plus the frontend regression suite. They were not browser-driven tests or a production load test.

To repeat the live workflow with the configured key, use Node 24 and run from the repository root:

```powershell
npm --prefix server run test:groq
```

This opt-in command makes real Groq requests and consumes account quota. It uses the locally cached MongoDB test binary; normal npm test continues to disable external credentials. The runner is server/scripts/testGroqLive.js. Its explicit --live flag is required when invoked directly.

Detailed safe metrics are saved under .test-tmp/groq-live-results.json and .test-tmp/groq-live-pdf-results.json. PDF/PNG files in that folder are synthetic QA intermediates.

## Resume detail follow-up

On 26 October the resume generator was improved with evidence-based writing instructions, a complete in-app preview, grouped skills, preserved project/experience detail and a more readable PDF. A live Groq tailoring/scoring run, with other providers disabled, expanded the 150-word fictional source to 232 words while retaining all eight skills, four experience bullets, the project bullet and the stated 25% result. The PDF was extracted and visually inspected. Subsequent validation also covers complete long Groq inputs, recovery of late legacy source details and multi-page export.

Groq's parsing/tailoring input now uses the complete resume up to 48,000 characters and omits database identifiers; over-limit input is rejected rather than silently clipped. OpenRouter and Gemini retain their previous input limits. A single bounded Groq JSON-format correction shares the original request deadline; authentication and quota errors do not trigger that correction.

Generated wording is checked for lost entries/bullets, removed skills, changed identities, unsupported technology claims and new or lost numerical facts. Before-and-after review and source-specific improvement suggestions remain available. Existing saved versions are not overwritten; generate a new tailored version to use the changes.

The final follow-up regression run passed 51 backend tests and 11 frontend tests. Lint and the clean production build passed. The live resume-quality run used a previously validated fictional parsed fixture for tailoring/scoring; fresh parsing was checked in the earlier live runs. Complete long-input transport, recovery of older long/offline-parsed resumes, soft-skill persistence and multi-page output were also checked with isolated regressions. The final sample PDF was rendered and inspected without clipping or unreadable punctuation.
