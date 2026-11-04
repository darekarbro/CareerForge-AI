# Phase 4 — Adaptive assessments and interviews

Phase 4 adds inspectable assessment evidence, answer-driven interview routing and learning plans based on saved practice and job requirements. Final resume and match scores use published local rules. Resume extraction and interview evaluation can still use providers allowed in the account's privacy settings. The measured baseline evaluates the offline parser and rubric, not live LLM quality.

## Delivered tasks

| Task | Implementation and evidence |
| --- | --- |
| Explicit rubrics | [Assessment rubric](docs/ASSESSMENT_RUBRICS.md) documents dimensions, weights, uncertainty, self-reported evidence and limitations. Resume assessments expose their version and limitations in the UI. |
| JD requirements | Required skills, preferred skills, experience and constraints retain stable IDs and original source clauses. Unclassified text remains available for review. |
| Requirement matching | Job workspaces show each requirement's status, supporting quotes and field paths, missing evidence, score weight and explanation. Missing evidence is not a finding of inability. |
| Evaluation dataset | [40 synthetic examples](server/evaluation/README.md): 30 development and 10 separate holdout cases, balanced across graduates, experienced candidates, sparse resumes, formatting and misleading inputs. |
| Quality measurement | [Published results](docs/PHASE4_EVALUATION_RESULTS.md) and [JSON](docs/PHASE4_EVALUATION_RESULTS.json) report extraction, unsupported supported-skill decisions, citation integrity, coverage, latency and offline cost. [Human-review import](docs/PHASE4_EVALUATION.md) supports independent scoring agreement once real reviewers supply annotations. |
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

## Reproduce measurements

From the repository root:

```bash
npm run evaluate:phase4
npm run evaluate:phase4 -- --output .test-tmp/phase4-development-results.json
```

CI records development results as an artifact. Holdout execution is explicit and reserved for a frozen publication; do not tune this implementation against its published holdout results. The [measurement guide](docs/PHASE4_EVALUATION.md) includes the publication and independent-human-review commands.

The published baseline has development skill F1 **95.05%**, requirement-status accuracy **94.94%**, and **0/39** unsupported supported-skill decisions. Holdout results are **100%** on the labeled skill/status metrics and **0/16** unsupported supported-skill decisions. Formatting remains weak: development skill recall is **71.43%** in that group. The small related holdout cannot establish general real-resume accuracy. Human scoring agreement and live-provider quality, usage and latency remain unmeasured; neither has been fabricated.

## Validation

The verification commands are:

```bash
npm test
npm run lint
npm run build
npm --prefix client run test:browser
```

Tests use fictional data and isolated databases. Browser verification covers requirement citations, same-session diagnostics, delayed-feedback privacy, retry history, competency links, learning tasks and reassessment navigation, alongside existing workflows and automated accessibility audits. Local logs, screenshots and traces are saved under the ignored `.test-tmp` directory.

Verified locally on 4 November 2026:

| Check | Observed result |
| --- | --- |
| Backend regression suite | 158 tests passed, no failures or skips. |
| Frontend regression suite | 47 tests passed, no failures or skips. |
| ESLint | Passed with zero allowed warnings. |
| Production build | Compiled and generated all 30 pages, including the new progress page; standalone bundle completed. |
| Browser workflows | 28 checks passed against the local API and temporary MongoDB. |
| Automated accessibility | 44 WCAG 2.0/2.1 A/AA audits, zero detected violations. |
| Consecutive diagnostic follow-ups | 3 targeted adaptive policy tests passed after final review, including distinct checks tied to the previous answer, deterministic replay and delayed-feedback redaction. |
| Development evaluation command | Reproduced the frozen development accuracy counts; implementation and dataset hashes remain unchanged. |

These checks establish behavior in the tested local environment. They do not establish human scoring agreement, live-provider quality or population-level hiring accuracy. The frozen benchmark used Node.js 25.9.0 on Windows; the repository's deployment target remains Node.js 24.
