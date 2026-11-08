# Fresh holdout: first-pass results without tuning

**The new holdout exposes substantial generalization gaps.** On 24 previously unscored, newly authored synthetic cases, resume-skill F1 is **21.57%**, requirement-status accuracy is **34.41%**, and **2/8 supported-skill decisions contradict the reference labels**. The parser, matcher and metric definitions were frozen before authoring and were not changed in response to these results.

Published 4 November 2026 (Asia/Kolkata). The first scored run started at `2026-11-04T14:15:11.702Z` and completed at `14:15:11.774Z`. The [raw report](PHASE4_FRESH_HOLDOUT_RESULTS.json) preserves every case-level error and group summary. The [completed receipt](../server/evaluation/protocols/v2-first-pass.receipt.json) records 24 completed cases and the raw report's SHA-256.

## What was held out

The [v2 dataset](../server/evaluation/dataset/v2/holdout.json) contains 12 formatting cases and a 12-case contradictory-skills cohort: nine actual candidate conflicts and three related controls. All identities, employers and histories are fictional. Cases vary headings, delimiters, column-like text, contact placement, wrapped prose, aliases, assertion order, third-party quotations and unrelated negation. No text duplicates a v1 resume after whitespace/case normalization.

A separate author agent received only the schema, public skill vocabulary and semantic annotation policy. It did not inspect the implementation, old fixtures or earlier predictions. A second agent reviewed every reference label before execution, also without implementation or prediction access. The [authoring record](../server/evaluation/dataset/v2/AUTHORING.md) and [label review](../server/evaluation/dataset/v2/LABEL_REVIEW.md) document this process. No label corrections were requested, and the labels were not changed after scoring. **These are agent-authored/reviewed synthetic references, not independent human judgments or an externally administered benchmark.**

## Freeze and execution evidence

| Stage | Evidence |
| --- | --- |
| Implementation frozen | Application commit `85919c7`; assessment version `careerforge-assessment-v3`. |
| Protocol preregistered | Commit `862cef5`; [protocol](../server/evaluation/protocols/v2-first-pass.json) specifies counts, metrics, independent author/reviewer access and no tuning. |
| Evaluator prepared | Commit `3607eac`; changes add version selection, freeze checks and first-pass receipts. Metric definitions were unchanged. |
| Dataset and labels committed before execution | Commit `8d2ead2`; [dataset lock](../server/evaluation/protocols/v2-first-pass.lock.json) includes dataset, reference-review, implementation, metric and evaluator hashes. |
| Single scored run preserved | Commit `0a7c715`; raw report and completed execution receipt. |
| No implementation or metric tuning | Assessment SHA-256 `302c2cc6e9d9d4495af6f29ccffb76f75d1a0b8b84ada60db3ee99228d6127f2`; metrics SHA-256 `a8231f12d7a3d47a60eb766eb28ad927ff7b08fab9af3b3f5e17b28ec08cd643`. Both match preregistration. |
| Dataset unchanged at execution | SHA-256 `82af4e8009775d91f5872c2541214de52302c098d37fcce69d0141b7ec8895c4`. |

The evaluator verified these hashes before parsing any holdout case. An exclusive receipt records the first attempt before scoring; an existing attempt/output cannot be silently reused as another first pass. The independent warmup used a separate example, not a holdout case. There was one scored execution of these 24 cases, with no post-result parser, matcher, metric or label changes.

## Measured results

| Metric | All 24 cases | Formatting (12) | Contradictory-skills cohort (12) |
| --- | ---: | ---: | ---: |
| Contact name/email exact fields | 34/48 (70.83%) | 13/24 (54.17%) | 21/24 (87.50%) |
| Resume skill true positives / false positives / false negatives | 11 / 2 / 78 | 6 / 0 / 55 | 5 / 2 / 23 |
| Resume skill precision | 84.62% | 100% | 71.43% |
| Resume skill recall | **12.36%** | 9.84% | 17.86% |
| Resume skill F1 | **21.57%** | 17.91% | 28.57% |
| JD skill category extraction F1 | 100% (93/93) | 100% (50/50) | 100% (43/43) |
| Requirement status accuracy | **32/93 (34.41%)** | 16/50 (32%) | 16/43 (37.21%) |
| Unsupported supported-skill decisions | **2/8 (25%)** | 0/3 | 2/5 (40%) |
| Citation integrity | 19/19 (100%) | 9/9 | 10/10 |
| Supported requirements with valid citations | 8/8 (100%) | 3/3 | 5/5 |
| All requirements with supported evidence | 8/93 (8.60%) | 3/50 (6%) | 5/43 (11.63%) |

Counts are per case-skill pair, not globally unique skill names. The parser recovered 11 of 89 gold positive skill assertions and missed 78. The false-supported rate has a small denominator of eight supported decisions; it is not a population estimate. Many correctly missing requirements contribute to status accuracy, so that percentage should be read alongside the very low positive-skill recall.

Local raw-text parsing plus matching had p50 **1.382 ms**, p95 **3.765 ms**, and mean **1.904 ms**, measured on Node.js 25.9.0, Windows x64, with one timed sample per case after warmup. There were **zero external provider requests, zero billed tokens and $0 external model cost**. Authoring/engineering/infrastructure costs, upload, OCR, queue/database, API/UI and network latency are excluded. Independent human score agreement remains **not measured**.

## What the failures show

The following explanations come from inspecting the frozen implementation and preserved case data after the single run; no fixes were applied.

- **Heading and section-boundary coverage is narrow.** Cases using labels such as `ENGINEERING PRACTICE`, `TOOLS I USE`, `WORK + SKILLS`, `SELF-ASSESSMENT`, prose identities or table-like blocks often never reach the parser's career-evidence fields. Eleven of twelve formatting cases miss all their gold skills. Only `fresh-format-08`, using recognized `EXPERIENCE` and `EDUCATION` sections with wrapped lines, has no recorded error in the measured contact/skill/status fields.
- **Missing sections can hide a denial while retaining a positive claim.** In `fresh-conflict-02`, a denial under `SELF-ASSESSMENT` precedes a recognized `COMPETENCIES` list. ReactJS is retained and React is incorrectly supported instead of uncertain. In `fresh-conflict-08`, the compact `Competencies ::` list is recognized while `Personal statement ::` does not form a narrative section. Rust is incorrectly supported despite an explicit denial.
- **Valid citations alone do not establish semantic support.** Both false-supported decisions coexist with 100% citation integrity. A quote can faithfully cite parsed data while extraction has omitted the contradictory statement from the original resume.
- **Contact exact-match accuracy mixes identity recovery and representation conventions.** For example, `fresh-format-01` writes `MARIN VELL` while its reference name is `Marin Vell`. The preregistered metric is case-sensitive exact matching. That convention was kept unchanged; no case-insensitive rescoring or post-result relabeling was used to raise the reported number.
- **JD requirement extraction worked in this scope.** All 93 labeled required/preferred skill pairs were extracted. That success did not compensate for poor resume extraction or establish correct matching.

The earlier 100% scores on the now-public v1 regression set were useful regression checks. This new first pass demonstrates that they did not establish generalization to new formats and source contexts. It also does not establish a representative production failure rate: this is a small, deliberately challenging synthetic set for two specific feature areas, with all cases targeting Software Engineer and English text.

## Complete case summary

TP/FP/FN are positive skill-extraction counts. “False supported” means decisions labeled supported when the reference is missing or uncertain. A denominator of zero is **not assessed**, not a perfect rate. Exact missing/unexpected skills and incorrect statuses are preserved in the JSON.

| Case | Skill TP/FP/FN | Contact fields correct | Requirement statuses correct | False supported |
| --- | ---: | ---: | ---: | ---: |
| fresh-format-01 | 0/0/5 | 1/2 | 1/4 | 0/0 |
| fresh-format-02 | 0/0/4 | 1/2 | 2/4 | 0/0 |
| fresh-format-03 | 0/0/5 | 1/2 | 1/4 | 0/0 |
| fresh-format-04 | 0/0/5 | 1/2 | 1/4 | 0/0 |
| fresh-format-05 | 0/0/5 | 1/2 | 1/4 | 0/0 |
| fresh-format-06 | 0/0/6 | 1/2 | 1/5 | 0/0 |
| fresh-format-07 | 0/0/5 | 1/2 | 1/4 | 0/0 |
| fresh-format-08 | 6/0/0 | 2/2 | 4/4 | 0/3 |
| fresh-format-09 | 0/0/4 | 1/2 | 1/3 | 0/0 |
| fresh-format-10 | 0/0/5 | 1/2 | 1/4 | 0/0 |
| fresh-format-11 | 0/0/6 | 1/2 | 1/5 | 0/0 |
| fresh-format-12 | 0/0/5 | 1/2 | 1/5 | 0/0 |
| fresh-conflict-01 | 0/0/2 | 2/2 | 1/3 | 0/0 |
| fresh-conflict-02 | 2/1/0 | 1/2 | 2/3 | 1/2 |
| fresh-conflict-03 | 0/0/2 | 2/2 | 1/3 | 0/0 |
| fresh-conflict-04 | 0/0/2 | 2/2 | 1/4 | 0/0 |
| fresh-conflict-05 | 0/0/2 | 2/2 | 1/3 | 0/0 |
| fresh-conflict-06 | 0/0/2 | 2/2 | 1/3 | 0/0 |
| fresh-conflict-07 | 0/0/3 | 2/2 | 1/4 | 0/0 |
| fresh-conflict-08 | 3/1/0 | 1/2 | 3/4 | 1/3 |
| fresh-conflict-09 | 0/0/2 | 2/2 | 1/4 | 0/0 |
| fresh-conflict-10 | 0/0/3 | 2/2 | 2/4 | 0/0 |
| fresh-conflict-11 | 0/0/2 | 2/2 | 1/3 | 0/0 |
| fresh-conflict-12 | 0/0/3 | 1/2 | 1/5 | 0/0 |

## Reproduction and lifecycle

This command was executed **once** after dataset commit and freeze validation. Repeating it as a first pass is blocked:

```bash
node server/scripts/evaluatePhase4.cjs --dataset-version v2 --holdout --first-pass server/evaluation/protocols/v2-first-pass.lock.json --output docs/PHASE4_FRESH_HOLDOUT_RESULTS.json
```

After publication, future executions of v2 are explicitly regression-only and must use a different output file:

```bash
npm run evaluate:phase4 -- --dataset-version v2 --holdout --output .test-tmp/phase4-v2-regression.json
```

The default command and CI continue to evaluate v1 development only; they do not repeatedly score v2. Nine targeted dataset/protocol/evaluation tests pass. Their model executions use v1 development only, while v2 validation is structural and reference-only. Application source and metric definitions remain byte-for-byte unchanged from the frozen implementation. All earlier reports are preserved. No performance fixes or label changes were made after observing the holdout.

Publication exposes these cases. They can now inform future regression work, but any subsequent generalization claim needs another newly reserved holdout. No claim is made about real applicant accuracy, employer outcomes, protected-characteristic fairness, multilingual robustness, OCR/PDF extraction, technical correctness, live-provider quality or human reviewer agreement.
