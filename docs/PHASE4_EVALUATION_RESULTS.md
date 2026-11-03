# Phase 4 frozen evaluation results

Published **4 November 2026** (Asia/Kolkata), generated `2026-11-03T19:55:55.108Z`. The [complete machine-readable report](PHASE4_EVALUATION_RESULTS.json) includes all case-level errors, group summaries, exact counts, dataset hashes and implementation hash. [Reproduction and metric definitions](PHASE4_EVALUATION.md) explain the measurement scope.

This run evaluates **40 fictional raw-text resumes and job descriptions**, with 30 development examples and 10 separate holdout examples. Each split covers graduates, experienced candidates, sparse resumes, unusual formatting and misleading input. Development examples informed source-filtering fixes; the implementation was frozen before the explicit holdout run. No holdout-driven fixes were made. The scorer is `careerforge-assessment-v2`; parsing and matching use local deterministic rules, with no external provider calls.

| Metric | Development (30) | Holdout (10) |
| --- | ---: | ---: |
| Contact name/email exact extraction | 59/60 (98.33%) | 20/20 (100%) |
| Resume skill precision / recall / F1 | 97.96% / 92.31% / **95.05%** | 100% / 100% / **100%** |
| JD skill category extraction F1 | 100% (79 TP, 0 FP, 0 FN) | 100% (25 TP, 0 FP, 0 FN) |
| Requirement status accuracy | 75/79 (94.94%) | 25/25 (100%) |
| Unsupported supported-skill decisions | 0/39 (0%) | 0/16 (0%) |
| Citation integrity | 96/96 (100%) | 42/42 (100%) |
| Supported requirements with valid evidence | 40/40 (100%) | 16/16 (100%) |
| All requirements with supported evidence | 40/82 (48.78%) | 16/25 (64%) |
| Independent human score agreement | **Not measured: no human reviews** | **Not measured: no human reviews** |
| Local pipeline p50 / p95 latency | 0.658 / 2.276 ms | 0.661 / 1.042 ms |
| Billed provider cost | $0; 0 calls, 0 tokens | $0; 0 calls, 0 tokens |

All-requirement evidence coverage describes available resume evidence, including experience and constraints; it is not an accuracy percentage. The unsupported-claim metric covers annotated skill decisions only. A valid citation is a quote in the parsed resume and does not verify proficiency. The 40 supported development requirements include one experience requirement, while only 39 supported skill decisions have a gold status annotation.

## Where this implementation performs well

Recognized required/preferred skill categories were recovered across all labeled cases. On ordinary development resumes, graduate, experienced and sparse groups each had 100% annotated requirement-status agreement. Misleading cases tested negated skills, conflicting claims, future learning intentions, contact/employer names and instruction-like input. None of the frozen run's **55 supported annotated skill decisions** contradicted the reference labels. These are narrow synthetic results, not proof that unsupported claims are impossible.

## Where it remains limited

Unusual formatting is the weakest measured group. In its six development cases, skill recall is **71.43%** (10/14), skill F1 is **83.33%**, and requirement-status accuracy is **76.47%** (13/17). `formatting-04` loses Java and SQL under spaced headings. `formatting-06` loses Python, SQL and the contact name in a flattened column header. `misleading-06` retains a contradictory React skill in extraction; matching correctly treats that requirement as uncertain. The JSON preserves each error.

The 10 holdout cases are small and related in structure to the development cases. Their perfect labeled percentages do not establish representative real-resume accuracy or justify a population confidence claim. Unknown technologies, experience/constraint correctness, semantic association of multiple durations to different skills, non-English sections, scanned PDFs, OCR, visual layout and technical proficiency are not measured by this initial gold set. Candidate statements remain self-reported.

**Human scoring agreement remains unavailable.** No reviewer judgments were fabricated or replaced by AI output. The [review template](../server/evaluation/human-review.template.json) and documented import command allow later independent reviews with reviewer identifiers, timestamps and rubric/dataset validation. Human scoring agreement and broader real-input evaluation remain necessary before claiming calibrated assessment quality.

Latency was measured on Node.js `v25.9.0`, Windows x64, with one timed parse-and-match sample per case after an independent warmup. The project targets Node.js 24; these numbers are observed local measurements, not a deployment performance guarantee. Upload, OCR, queue/database, API/UI latency, live model quality, live model usage/pricing and infrastructure cost remain unmeasured. Provider cost is zero because this benchmark runs offline.
