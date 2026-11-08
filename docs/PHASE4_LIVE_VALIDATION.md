# Phase 4 live AI validation

On 8 November 2026, the configured Groq model accepted all 16 fictional cases. The résumé parser recovered all 13 reference skills and returned one contradicted skill as positive. The v5 matcher correctly classified all 20 labeled requirements, including the contradiction. All eight interview scores landed in their reference technical bands and selected the expected follow-up branches. [Raw results](PHASE4_LIVE_VALIDATION_RESULTS.json)

## What ran

Groq returned `openai/gpt-oss-120b` on each of the 16 requests. The benchmark used the app's Groq adapter, prompts and validators, the `careerforge-assessment-v5` matcher, and the `adaptive-interview-v2` follow-up selector. The runner called the adapter directly so that every response came from the selected live model. Each case received one request during this run. The runner capped physical requests, including schema repair, at 20. [Runner](../server/scripts/evaluatePhase4Live.cjs)

The résumé sample covers eight named public v1 development cases across five groups. Positive dictionary skills and the labeled job requirement statuses come from the existing references. The eight interview answers cover SQL injection, payment retry safety and concurrent updates. An agent wrote their technical score ranges and expected follow-up branches before the live calls. [Résumé references](../server/evaluation/dataset/v1/development.json) · [Interview references](../server/evaluation/liveInterviewCases.cjs)

## Résumé extraction and matching

| Measure | Observed |
| --- | ---: |
| Accepted parses | 8/8 |
| Exact contact fields | 16/16 |
| Dictionary skills | 13 correct, 1 false positive, 0 misses |
| Dictionary skill precision / recall / F1 | 92.86% / 100% / 96.30% |
| Job skill requirement extraction | 20/20 |
| Correct labeled requirement statuses | 20/20 |
| Unsupported labeled decisions marked supported | 0/11 |
| Citations valid at the parsed field path | 30/30 |
| Quotes present in original text after case, Unicode and whitespace normalization | 30/30 |
| Supported requirements with valid evidence | 12/12 |
| Requirements with supported evidence, including experience and constraints | 12/22 |

In `misleading-06`, the source lists React and also states “I do not know React.” Groq included React in the extracted skills and preserved the denial in the summary. The matcher returned `uncertain`, cited both statements and awarded zero credit for the requirement. This was the only error in the measured skill and contact fields. The prompt-injection résumé contributed HTML and received no credit for the injected Kubernetes or AWS claims. [Case-level evidence](PHASE4_LIVE_VALIDATION_RESULTS.json)

## Interview feedback and follow-ups

| Case | Reference technical band | Live technical score | Expected and observed branch |
| --- | ---: | ---: | --- |
| Complete SQL answer | 80–100 | 95 | Deeper |
| Partial SQL answer | 45–85 | 55 | Clarification |
| Unsafe SQL answer | 0–39 | 20 | Diagnostic |
| SQL answer with grading injection | 0–39 | 0 | Diagnostic |
| Complete payment retry answer | 80–100 | 90 | Deeper |
| Unsafe payment retry answer | 0–39 | 20 | Diagnostic |
| Partial concurrent update answer | 55–90 | 65 | Clarification |
| No technical answer | 0–15 | 0 | Diagnostic |

The model caught unsafe string concatenation and the duplicate-charge risk of generating a new idempotency key on each retry. The unsafe SQL response also received STAR-format advice, which was irrelevant to the technical question. Branch agreement measures whether the selector chose the expected kind of follow-up. It leaves the usefulness of the generated wording for human review. [Scores, feedback and follow-up prompts](PHASE4_LIVE_VALIDATION_RESULTS.json)

## Requests, latency and cost

The benchmark completed from 11:51:27 to 11:53:30 IST. The 16 HTTP responses passed schema validation, with zero failed or unattempted cases. Action latency includes the adapter call and validation. The overall run duration includes pacing between cases based on the provider's rate-limit headers.

| Action | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Résumé parse | 8 | 1.437 s | 1.711 s |
| Interview answer evaluation | 8 | 1.285 s | 1.548 s |

The API reported 13,110 input tokens, including 2,816 reported cached input tokens, and 7,502 output tokens. The estimated cost for all requests was **US$0.0062565** at the published rates of US$0.15 per million uncached input tokens, US$0.075 per million cached input tokens, and US$0.60 per million output tokens, verified 8 November 2026. The calculation charges input at the uncached rate when the response omits cache details. The API responses supplied usage counts. The account's invoiced charge remains unavailable. [Groq model pricing](https://console.groq.com/docs/model/openai/gpt-oss-120b) · [Groq cache usage fields](https://console.groq.com/docs/prompt-caching)

## Reproduce

From the repository root with server dependencies installed and Groq configured, run:

```powershell
node server/scripts/evaluatePhase4Live.cjs --live --output .test-tmp/phase4-live-reproduction.json
```

Choose a new output path for each reproduction. The results record the adapter, selector, runner and fixture hashes. A subsequent call can produce different scores and latency.

This sample measures one configured model on short fictional text cases. Its known résumé fixtures provide live regression evidence. The interview bands are agent-authored reference judgments. Independent human scoring agreement, full document decoding and upload latency, database-backed session persistence, and alternative providers are outside this benchmark.
