# Phase 4 — Adaptive assessments and interviews

Phase 4 provides inspectable assessment evidence, answer-driven interview routing and learning plans based on saved practice and job requirements. Final resume and match scores use versioned local rules. Resume extraction and interview feedback can use providers allowed by the account's privacy settings.

## Delivered tasks

| Task | Implementation and evidence |
| --- | --- |
| Explicit rubrics | [Assessment rubric](docs/ASSESSMENT_RUBRICS.md) documents dimensions, weights, uncertainty, self-reported evidence and limitations. Resume assessments expose their version and limitations in the UI. |
| JD requirements | Required skills, preferred skills, experience and constraints retain stable IDs and original source clauses. Unclassified text remains available for review. |
| Requirement matching | Job workspaces show each requirement's status, supporting quotes and field paths, missing evidence, score weight and explanation. Missing evidence is not a finding of inability. |
| Evaluation dataset | The initial 40 synthetic examples cover graduates, experienced candidates, sparse resumes, formatting and misleading inputs. Separate versioned holdouts extend that coverage. [Dataset guide](server/evaluation/README.md) |
| Quality measurement | Published results cover extraction, supported decisions, citation integrity, evidence coverage, latency and cost. The independent review workflow accepts genuine reviewer scores. [Measurement guide](docs/PHASE4_EVALUATION.md) |
| Adaptive interviews | [Routing policy](docs/ADAPTIVE_INTERVIEWS.md) chooses clarification, deeper or simpler diagnostic questions using the previous answer and feedback, within the requested session count. |
| Competency profile | [Profile rules](docs/COMPETENCY_PROFILE.md) track strengths, developing topics and gaps across sessions with links to questions and historical attempts. Retries count once per question in averages. |
| Learning plans | [Learning-plan rules](docs/LEARNING_PLANS.md) produce practice tasks, small project milestones, completion conditions and three-question reassessments. Job-only gaps remain unassessed; obsolete resume revisions cannot create new training tasks. |

## Demonstrate adaptation

1. Open a job workspace, select a saved resume, and run **Check job match**. Inspect required and preferred skills, source quotes, missing evidence and rubric limitations. Experience and practical constraints remain separately explained.
2. Start interview practice with **Adapt questions to my answers** checked and at least three questions. Submit a short answer such as “I do not know.” The next question becomes a simpler diagnostic on the same topic, keeping the session's question count. More detailed answers can select clarification or deeper branches; the policy tests cover all three outcomes.
3. Complete the session. For delayed feedback, scores and adaptation rationale unlock at completion. Review a previous answer and retry it: the earlier attempt remains available and the existing follow-up branch is preserved.
4. Open **Practice history → View competency evidence and learning plan**. Expand a topic's answers and follow a link to its original question and attempt. Inspect the tasks, project milestones and completion criteria; use **Reassess** to start focused practice. A job-only gap opens setup with its source resume, job description, focus and three-question count.
5. Edit the source resume. Its old job-gap report is excluded from new learning recommendations; the progress page asks for a fresh job match. Reassess the job to update the plan.

Adaptive sessions answer in order so future prompts cannot collect drafts before adaptation. The first topic can continue through the entire session; use separate focused sessions for broader coverage. A one-question session has no follow-up slot. Existing sessions retain their saved fixed/adaptive behavior.

Offline practice checks selected binary search, transaction atomicity and HTTP storage questions. Other technical topics keep their answer history with provisional feedback. Those provisional answers do not establish competency strengths or gaps or create interview-based learning tasks. [Offline scoring and routing](docs/ADAPTIVE_INTERVIEWS.md)

## Validation status

Assessment v6 passed all 30 public v4 regression cases with 60/60 exact contact fields, 120/120 skills, 164/164 correct requirement decisions and 0/115 unsupported positive decisions. The expanded rerun matched all 11 experience judgments, all eight practical constraints and all 10 offline technical bands and follow-up branches. These reruns measure the published inputs. [V6 regression results](docs/PHASE4_V6_REGRESSION_RESULTS.md)

### Live Groq investigation

The first v6 live run accepted 15/16 cases. `live-payment-unsafe` received HTTP 200 and reported token usage, then failed with `UNKNOWN`. Injecting that error into the original runner’s report write reproduced the same outcome with a mocked successful response. The original record contains only the error code, so the cause remains unconfirmed. The runner now saves reports at case boundaries, retries transient file errors without another provider call and records the stage of provider, validation and measurement failures. [Original v6 live result](docs/PHASE4_V6_LIVE_RESULTS.json) · [Runner regression tests](server/test/phase4LiveEvaluation.test.js)

The Node 24 rerun used the same Groq GPT-OSS 120B adapter and fictional cases. All 16 requests succeeded and all 16 results were accepted, with zero checkpoint retries. The resume results reached 100% skill F1, 16/16 exact contact fields and 20/20 correct requirement statuses, with 0/11 unsupported positive decisions. All eight interviews matched both the expected technical band and follow-up branch. The previously failed payment answer scored 20/100 and triggered a diagnostic follow-up. The feedback explained the duplicate-charge risk and also included irrelevant STAR-format advice. [Raw live rerun](docs/PHASE4_V6_LIVE_RERUN_RESULTS.json)

Resume extraction measured 1.43 s p50 and 2.13 s p95. Interview feedback measured 1.28 s p50 and 1.88 s p95. Groq reported 13,110 input tokens, including 2,816 cached tokens, and 8,280 output tokens. The published-rate cost estimate was $0.0067233. These timings come from one run on eight cases per action. [Live timing and usage](docs/PHASE4_V6_LIVE_RERUN_RESULTS.json) · [Groq pricing](https://console.groq.com/docs/model/openai/gpt-oss-120b)

### Frozen v5 results

The frozen v5 engine's first pass on 30 new v4 cases achieved 78.14% skill F1, 116/164 correct requirement statuses and 37/60 exact contact fields. Ten of 89 labeled positive decisions were unsupported by the reference evidence. Third-party attribution accounted for eight of those ten decisions. [Fresh holdout results](docs/PHASE4_V5_HOLDOUT_RESULTS.md)

Assessment v5 resolved the measured v3 failures across 24 public cases. The regression run recorded 117/117 skills, 136/136 requirement decisions, 48/48 contact fields and 0/100 unsupported supported decisions. [V5 regression results](docs/PHASE4_V3_REGRESSION_RESULTS.md)

The live Groq GPT-OSS 120B benchmark accepted all 16 fictional cases. Resume skill F1 was 96.30%, all 20 labeled match decisions were correct, and all eight interview score bands and follow-up branches matched their references. The parser retained one contradicted skill, which the matcher marked uncertain. Groq reported 13,110 input tokens and 7,502 output tokens. The published-rate estimate was $0.0062565. [Live benchmark](docs/PHASE4_LIVE_VALIDATION.md)

The broader offline suite matched 6/11 experience judgments and 5/8 constraint judgments. Interview technical bands and follow-up branches each matched 4/10 references. Three supported experience decisions lacked sufficient evidence. Practice history retained all six answer links, while competency statuses and learning recommendations showed semantic errors in the tested history. [Expanded validation](docs/PHASE4_EXPANDED_VALIDATION.md)

### Independent human scoring

Human scoring agreement is pending two independent ballots. Each reviewer scores the same 10 fictional cases from the published v1 holdout using the v5 rubric. The evaluator compares both ballots against the archived v5 predictions once they are complete. [Reviewer packet](docs/PHASE4_HUMAN_REVIEW_PACKET.md) · [Blank ballot](server/evaluation/human-review.v5-holdout.ballot.json)

## Reproduce verification

Run the development benchmark from the repository root. CI records its results as an artifact. Published holdouts can be rerun as regression checks using a separate output path. [Measurement guide](docs/PHASE4_EVALUATION.md)

```bash
npm run evaluate:phase4 -- --output .test-tmp/phase4-development-results.json
npm run evaluate:phase4 -- --dataset-version v4 --holdout --output .test-tmp/phase4-v4-regression.json
```

The application verification commands cover the server, client, build and browser workflows.

```bash
npm test
npm run lint
npm run build
npm --prefix client run test:browser
```

Tests use fictional data and isolated databases. Browser verification covers requirement citations, same-session diagnostics, delayed-feedback privacy, retry history, competency links, learning tasks and reassessment navigation, alongside existing workflows and automated accessibility audits. Local logs, screenshots and traces are saved under the ignored `.test-tmp` directory.

The 4 November 2026 v5 regression repair passed **283 server and 49 client tests**. Earlier browser verification covered 28 local workflows and 44 automated accessibility audits. [V5 test results](docs/PHASE4_V3_REGRESSION_RESULTS.md) · [Original evaluation](docs/PHASE4_EVALUATION_RESULTS.md)

On 8 November, 50 focused Phase 4 tests passed across evaluation, matching, adaptive practice and the v3 regressions. The three structural holdout checks passed for v2, v3 and v4.

The calendar and reminders OpenAPI update and live runner repair passed all **347 server tests and 51 client tests** in a committed Node 24 snapshot. The server run verified the full route inventory and exercised transient and permanent checkpoint failures with mocked provider responses. [OpenAPI contract tests](server/test/contracts.test.js) · [Runner regression tests](server/test/phase4LiveEvaluation.test.js)

| Check | Observed result |
| --- | --- |
| ESLint | Passed with zero allowed warnings. |
| Production build | Compiled and generated all 30 pages, including the progress page. The standalone bundle completed. |
| Browser workflows | 28 checks passed against the local API and temporary MongoDB. |
| Automated accessibility | 44 WCAG 2.0/2.1 A/AA audits, zero detected violations. |
| Consecutive diagnostic follow-ups | 3 targeted adaptive policy tests passed after final review, including distinct checks tied to the previous answer, deterministic replay and delayed-feedback redaction. |
