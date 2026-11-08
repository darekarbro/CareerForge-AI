# Phase 4 v6 regression results

Assessment v6 resolves the measured contact, skill attribution, experience and offline interview failures on the published cases. This evaluation uses the same references as the v5 measurements. The v4 first-pass report remains the record of performance on new inputs. [Frozen v5 first pass](PHASE4_V5_HOLDOUT_RESULTS.md)

## Contact and skill extraction

The parser reads contact fields in forms, tables and transcripts and assigns them to the candidate. Skill evidence follows column and speaker ownership, recognizes explicit work statements in keyed and prose layouts, and preserves contradictions for review. Live extraction also restores source-grounded contradictions when the provider leaves out the denial.

| V4 measure | V5 first pass | V6 regression |
| --- | ---: | ---: |
| Exact contact fields | 37/60 | 60/60 |
| Skills recovered | 84/120 | 120/120 |
| Extra skills | 11 | 0 |
| Skill F1 | 78.14% | 100% |
| JD category and skill pairs recovered | 162/164 | 164/164 |
| Correct requirement statuses | 116/164 | 164/164 |
| Unsupported among labeled positive decisions | 10/89 | 0/115 |
| Valid citations | 283/283 | 349/349 |

All 30 v4 cases passed the end-to-end regression check for exact contact fields, skills, requirement categories and statuses, schema validation and citation validity. [V4 raw results](PHASE4_V6_REGRESSION_V4_RESULTS.json) · [Regression tests](../server/test/v3AccuracyRegression.test.js)

All 115 supported requirements in the v4 rerun had valid evidence. Across all 172 extracted requirements, 115 had supported evidence. Local extraction and matching took 14.36 ms p50 and 36.48 ms p95 with zero provider requests. [V4 evidence coverage and timing](PHASE4_V6_REGRESSION_V4_RESULTS.json)

| Earlier regression split | Skill F1 | Correct requirement statuses | Exact contacts |
| --- | ---: | ---: | ---: |
| V1 development | 100% | 79/79 | 60/60 |
| V1 holdout | 100% | 25/25 | 20/20 |
| V2 holdout | 100% | 93/93 | 47/48 |
| V3 holdout | 100% | 136/136 | 48/48 |

The v2 casing difference reflects the exact source spelling `MARIN VELL` and its title-case reference. [V1 raw results](PHASE4_V6_REGRESSION_V1_RESULTS.json) · [V2 raw results](PHASE4_V6_REGRESSION_V2_RESULTS.json) · [V3 raw results](PHASE4_V6_REGRESSION_V3_RESULTS.json)

## Experience and offline practice

The matcher binds years and months to their own skill, candidate and work domain. It uses relevant closed date intervals for general tenure and counts overlaps once. Explicit practical requirements remain available for confirmation. The offline scorer checks the relevant concepts and common misconceptions for selected binary search, transaction atomicity and HTTP storage questions. Other technical answers receive provisional feedback and remain outside competency strength and gap decisions.

| Expanded challenge measure | V5 | V6 |
| --- | ---: | ---: |
| Correct experience statuses | 6/11 | 11/11 |
| Unsupported positive experience decisions | 3/6 | 0/4 |
| Correct practical constraint statuses | 5/8 | 8/8 |
| Interview technical score bands | 4/10 | 10/10 |
| Expected follow-up branches | 4/10 | 10/10 |
| Unsound answers sent to a deeper question | 3/4 | 0/4 |
| Competency statuses aligned with reference evidence | 0/3 | 3/3 |
| Learning recommendations aligned with reference evidence | 1/3 | 3/3 |

The expanded evaluation uses fictional structured resumes and reference answers. The checks cover bounded phrasing for the three rubric topics. Competency history, six answer links and stale report exclusions passed in the tested history. [V6 expanded raw results](PHASE4_V6_EXPANDED_RESULTS.json) · [V5 expanded report](PHASE4_EXPANDED_VALIDATION.md)

## Live Groq rerun

Groq GPT-OSS 120B returned HTTP success for all 16 requests. The evaluator accepted all eight resume results and seven of eight interview results. The `live-payment-unsafe` case recorded an `UNKNOWN` failure after its successful HTTP response. The recorded output does not identify the cause. The case counts as failed in the end-to-end totals and is excluded from latency and scoring summaries for accepted results. [V6 live raw results](PHASE4_V6_LIVE_RESULTS.json) · [V5 live report](PHASE4_LIVE_VALIDATION.md)

| Live measure | V5 | V6 |
| --- | ---: | ---: |
| Accepted cases | 16/16 | 15/16 |
| Resume skill F1 | 96.30% | 100% |
| Exact resume contact fields | 16/16 | 16/16 |
| Correct requirement statuses | 20/20 | 20/20 |
| Unsupported among labeled positive decisions | 0/11 | 0/11 |
| Jointly correct interview band and follow-up across attempted cases | 8/8 | 7/8 |
| Estimated provider cost | $0.0062565 | $0.0062415 |

All 12 supported requirements had valid citations and all 31 resume quotes matched the source text after normalization. Accepted resume actions measured 1.40 s p50 and 1.69 s p95. Accepted interview actions measured 1.31 s p50 and 1.64 s p95. Groq reported 13,110 input tokens, including 1,536 cached tokens, and 7,317 output tokens across 16 requests. The cost uses published rates. These small synthetic samples measure a single run. [V6 live timing, usage and price basis](PHASE4_V6_LIVE_RESULTS.json)

## Reproduce

Run the same public fixtures from the repository root and choose new output paths.

```powershell
node server/scripts/evaluatePhase4.cjs --all --output .test-tmp/phase4-v6-v1.json
node server/scripts/evaluatePhase4.cjs --dataset-version v2 --holdout --output .test-tmp/phase4-v6-v2.json
node server/scripts/evaluatePhase4.cjs --dataset-version v3 --holdout --output .test-tmp/phase4-v6-v3.json
node server/scripts/evaluatePhase4.cjs --dataset-version v4 --holdout --output .test-tmp/phase4-v6-v4.json
node server/scripts/evaluatePhase4Expanded.cjs --output .test-tmp/phase4-v6-expanded.json
```

The live command requires a configured Groq key and sends fictional inputs to the provider. It measures new responses. [Live run instructions](PHASE4_LIVE_VALIDATION.md)

## Verification

The committed server snapshot passed 343 of 344 tests on Node 24. All Phase 4 regressions passed, including the interview API and archived ballot import. The sole failure also reproduced on the pre-repair commit `9540547`. The OpenAPI contract omits the existing application calendar and reminder routes. The v2–v4 offline commands reproduced their published accuracy results from the Windows snapshot.

Human scoring agreement awaits two completed ballots. The issued packet compares the published v1 cases with the archived v5 scores. [Agreement instructions](PHASE4_EVALUATION.md#collect-independent-human-reviews)
