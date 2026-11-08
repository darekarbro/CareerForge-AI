# Expanded Phase 4 validation

Assessment v5 correctly classified 6 of 11 experience expectations and 5 of 8 practical constraints in this synthetic challenge suite. The offline interview evaluator and follow-up policy each agreed with 4 of 10 reference judgments. Three of four incorrect or nonresponsive answers received deeper questions. The resulting practice history kept its evidence links, while scoring errors changed the topics and difficulty of the learning plan.

The suite ran on 8 November 2026 using the production matcher, deterministic interview provider, follow-up selector, competency builder and learning-plan builder. It used fictional, structured resume data to isolate matching from resume import. The author knew the implementation and wrote the [reference labels](../server/evaluation/dataset/expanded-v1.json) before scoring. This is a targeted challenge suite with agent-authored judgments. Independent human agreement and unseen-input generalization are outside this run's measurement scope. The [JSON report](PHASE4_EXPANDED_VALIDATION.json) records every result, citation, policy version and file fingerprint.

## Experience and constraints

Seventeen resume and job pairs contain eleven expected experience requirements and eight expected constraints. An extracted requirement must match the reference category and source clause. Missing rows count as wrong status decisions. Experience metadata also checks the minimum duration in years, skill scope and optionality for numeric requirements.

| Metric | Experience | Constraints |
| --- | ---: | ---: |
| True positives / false positives / false negatives | 9 / 0 / 2 | 5 / 1 / 3 |
| Extraction precision / recall / F1 | 100% / 81.82% / 90.00% | 83.33% / 62.50% / 71.43% |
| Correct status decisions | 6/11 | 5/8 |
| Correct numeric metadata | 9/10 | — |
| Unsupported decisions among supported rows | 3/6 | No supported rows |
| Citations found at the stated resume path | 9/9 | No citations |

- The matcher credited a personal Python duration, closed work intervals and a preferred Kubernetes range. It left overlapping and open-ended tenure uncertain and withheld credit for an explicitly denied duration.
- Three experience decisions credited unsupported evidence. The matcher used seven Python years to support a PostgreSQL minimum, eight years belonging to a colleague to support an AWS minimum, and retail tenure to support a software delivery requirement. All three cited text that genuinely appears in the resume, so citation integrity alone misses these errors.
- The extractor missed an 18-month React requirement and qualitative incident-response experience. It recognized remote, relocation, authorization, on-site and travel requirements and left them uncertain. It missed UTC overlap, a driving licence and evening shifts, and incorrectly treated an optional travel reimbursement as a constraint.

## Interview scoring and follow-ups

Ten answers span correct explanations, correct paraphrases, misconceptions, an incomplete answer and a non-answer. The reference technical labels describe the content. For comparison, this evaluation maps provider scores below 40 to `unsound`, 40 through 74 to `partial`, and 75 or higher to `sound`. These bands are evaluation conventions. The authored follow-up labels express the preferred branch for each answer.

| Metric | Observed |
| --- | ---: |
| Technical band agreement | 4/10 |
| Follow-up branch agreement | 4/10 |
| Sound answer ranked above an unsound answer to the same question | 0/4 |
| Unsound answers sent to a deeper question | 3/4 |

The evaluator gave 85/100 to correct rubric-worded answers and to keyword-rich misconceptions about sorted order and transaction boundaries. It gave 25/100 to correct paraphrases on those two topics. The four paired comparisons contained two ties and two reversals. The short non-answer received a diagnostic as expected. The partial cache answer received a diagnostic where the reference called for clarification.

The answer references use ordinary binary search on sorted arrays, a single atomic database transaction and the HTTP `no-store` response directive. [NIST binary search definition](https://xlinux.nist.gov/dads/HTML/binarySearch.html) · [PostgreSQL transaction tutorial](https://www.postgresql.org/docs/18/tutorial-transactions.html) · [RFC 9111 cache directives](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5)

## Competencies and learning recommendations

One synthetic history puts five scored answers across two sessions into the production competency builder. One question has an earlier attempt. The plan also receives job-match reports containing a current skill gap, an obsolete latest report with an older sibling, a report lacking a revision and a report for a deleted resume.

| Metric | Observed |
| --- | ---: |
| Competency statuses aligned with technical evidence | 0/3 |
| Topic history counts correct | 3/3 |
| Historical and current attempt links present | 6/6 |
| Expected practice topics present | 2/3 |
| Expected topics with aligned difficulty and evidence type | 1/3 |
| Emitted recommendations with valid source links and actionable structure | 3/3 |

Binary search was marked developing at 71/100 despite two technically sound latest answers. Transaction atomicity was marked a strength at 86/100 despite two material misconceptions. The partial caching answer became a gap at 53/100. The plan recommended binary search, left out the transaction topic, and chose Easy for caching where the reference expected Medium. Its Docker recommendation correctly remained an unassessed job gap.

The selection logic excluded one stale report, one unversioned report and one report for a missing resume. The older sibling stayed excluded, and the remote constraint generated no practice task. Each emitted recommendation had linked evidence, two practice tasks, two milestones with completion criteria and a three-question reassessment. This one history checks evidence and task structure alongside semantic alignment. It provides no measurement of actual learning outcomes.

## Reproduce

Run from the repository root after installing server dependencies. Choose a new output path to keep the published report available.

```powershell
node server/scripts/evaluatePhase4Expanded.cjs --output .test-tmp/phase4-expanded-reproduction.json
```

The measured run used Node.js v25.9.0 on Windows x64. It made zero external provider requests, used zero billed tokens and incurred zero external model cost. Fourteen existing targeted tests passed across the matcher, adaptive policy, competency history and learning-plan services. The challenge results above measure semantic behavior on this sample, including cases that the existing behavioral tests do not cover.
