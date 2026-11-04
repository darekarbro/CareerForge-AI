# Assessment accuracy improvements and fresh validation

The v4 engine resolves the measured skill-extraction and matching errors in the published v1/v2 cases. **The fresh v3 holdout still exposes limitations:** skill F1 is **78.17%**, requirement-status accuracy is **66.91%**, and **3/68 supported decisions are unsupported** by the reference labels. Known-set success does not establish general accuracy.

Published 4 November 2026. All fixtures are fictional, English-dominant raw text. V2/v3 references were authored and reviewed by separate agents, not independent human annotators. V1 labels were authored independently of model output; a separate blind-review record is not available for v1. This experiment measures the offline fallback parser and local matcher; it does not measure live LLM quality, PDF/OCR reading order, technical proficiency or hiring outcomes.

## What changed

- Contacts are extracted from the full document, including contact-first rows, combined identity/email rows, frames, columns, first-person introductions and later contact sections. Source spelling and case are preserved; ambiguous names stay unknown, and third-party addresses are excluded.
- Section recognition accepts semantic, spaced, inline and parallel headings. Wrapped source paragraphs retain their whitespace. Eligible candidate statements that cannot be placed confidently are retained verbatim in the summary with an import-review warning.
- Skill claims distinguish personal work, bare lists, learning goals, employer identities, quoted requirements and other people's claims. Denials apply to the named skill rather than vetoing unrelated positive evidence in the same sentence.
- Both sides of a contradiction remain reviewable, while the conflicting skill is withheld from positive lists and receives no match credit. Structured project/experience fields preserve quote ownership across wrapped lines.
- Assessment version `careerforge-assessment-v4` / engine `assessment-rules-v4` invalidates old cached assessments. Scoring weights and metric definitions are unchanged. See the [rubric](ASSESSMENT_RUBRICS.md).

Small commits separate contact recovery, layout recognition, wrapped paragraphs, claim classification, matching integration, review-discovered regressions, versioning, datasets, freeze records and results.

## Known-set regression results

The public v2 failures informed these improvements. V1 and v2 are now regression evidence; neither is an unseen test. All existing fixture labels and historical first-pass reports remain unchanged.

| Metric | Original v2 first pass, v3 engine | V2 regression, v4 engine | V1 development, v4 | V1 published holdout, v4 |
| --- | ---: | ---: | ---: | ---: |
| Cases | 24 | 24 | 30 | 10 |
| Contact exact fields | 34/48 (70.83%) | 47/48 (97.92%) | 60/60 | 20/20 |
| Skill TP / FP / FN | 11 / 2 / 78 | 89 / 0 / 0 | 52 / 0 / 0 | 19 / 0 / 0 |
| Skill precision / recall / F1 | 84.62% / 12.36% / 21.57% | 100% / 100% / 100% | 100% / 100% / 100% | 100% / 100% / 100% |
| JD skill category F1 | 100% | 100% | 100% | 100% |
| Requirement status accuracy | 32/93 (34.41%) | 93/93 (100%) | 79/79 | 25/25 |
| Unsupported supported decisions | 2/8 (25%) | 0/57 | 0/43 | 0/16 |
| Citation integrity | 19/19 | 184/184 | 101/101 | 42/42 |

The remaining v2 contact mismatch is `MARIN VELL` in the source versus `Marin Vell` in the reference. The case-sensitive exact metric and original reference are preserved. The parser retains the actual source spelling instead of title-casing names to improve a benchmark score.

Raw measurements: [v1 regressions](PHASE4_ACCURACY_V1_RESULTS.json), [v2 regression](PHASE4_ACCURACY_V2_RESULTS.json), [preserved original v2 first pass](PHASE4_FRESH_HOLDOUT_RESULTS.json). Actual latency samples and all case-level failures are retained in each file. Latency varies with background activity; these regression runs overlapped local tests and are not a controlled speed comparison.

## Fresh v3 holdout: one untuned run

The [new dataset](../server/evaluation/dataset/v3/holdout.json) contains 24 independently authored cases: 12 formatting cases and 12 contradictory-skills cases (nine actual conflicts and three controls). The author did not access implementation, earlier fixtures or predictions. A separate reviewer accepted all 24 cases without changes, before execution. Their [authoring record](../server/evaluation/dataset/v3/AUTHORING.md) and [label review](../server/evaluation/dataset/v3/LABEL_REVIEW.md) record these access boundaries.

V3 was authored independently while v2-informed implementation changes were in progress. Its case content remained withheld from implementation agents until after scoring. The reviewed dataset was committed at `1e020b6`. After known-set fixes and tests, implementation commit `3b67db2`, source trees, rubric, dataset, metrics and evaluator were frozen in the [protocol](../server/evaluation/protocols/v3-first-pass.json) and [lock](../server/evaluation/protocols/v3-first-pass.lock.json), committed at `2da6f7c` before execution.

The single scored run started at `2026-11-04T17:06:31.266Z`. The [raw first-pass report](PHASE4_ACCURACY_V3_HOLDOUT_RESULTS.json) and [completed receipt](../server/evaluation/protocols/v3-first-pass.receipt.json) were preserved at `5fb5d02`. No parser, matcher, metric or label tuning followed this run. An exclusive receipt prevents another attempt from being presented as the first run.

| Metric | All 24 | Formatting (12) | Contradictory-skills cohort (12) |
| --- | ---: | ---: | ---: |
| Contact exact fields | 40/48 (83.33%) | 19/24 (79.17%) | 21/24 (87.50%) |
| Skill TP / FP / FN | 77 / 3 / 40 | 47 / 0 / 27 | 30 / 3 / 13 |
| Skill precision | 96.25% | 100% | 90.91% |
| Skill recall | 65.81% | 63.51% | 69.77% |
| Skill F1 | **78.17%** | 77.69% | 78.95% |
| JD skill category F1 | 98.53% | 97.22% | 100% |
| Requirement status accuracy | **91/136 (66.91%)** | 48/72 (66.67%) | 43/64 (67.19%) |
| Unsupported supported decisions | **3/68 (4.41%)** | 0/37 | 3/31 (9.68%) |
| Citation integrity | 186/186 (100%) | 102/102 | 84/84 |
| Supported requirements with valid citations | 68/68 (100%) | 37/37 | 31/31 |
| All requirements with supported evidence | 68/136 (50%) | 37/72 (51.39%) | 31/64 (48.44%) |

Counts are per case-skill pair. The two false-positive and two false-negative JD pairs represent category errors in one case, not four unknown technologies. Missing skills and correctly missing requirements affect different denominators; status accuracy should be considered alongside recall and false-supported decisions.

Local parse-plus-match latency was p50 **9.479 ms**, p95 **16.093 ms**, mean **9.269 ms** on Node.js 25.9.0, Windows x64. There was one timed sample per case after a separate warmup. Upload, OCR, database, queue, API/UI and network time are excluded. External requests, billed tokens and external model cost were **0 / 0 / $0**; authoring, engineering and infrastructure costs are excluded. Independent human score agreement remains **not measured**. The repository targets Node 24; this local runtime is recorded for reproducibility.

V2 and v3 differ in examples and labels, so the two first-pass percentages are not a paired causal estimate of improvement. V3 provides independent evidence of current behavior in this limited scope, and demonstrates that the 100% known-set numbers still overstate generalization.

## Remaining errors and implications

- **Compact skill labels and table context still lose evidence.** `TOOLBOX //`, `Web [TypeScript; ...]`, `Cloud toolkit:`, `Focus:`, category/value tables and wrapped `Work kit:` / `Strengths:` rows are not consistently recognized as personal skill declarations. These account for many of the 40 missed positive skills. Missing a positive half of a conflict can also turn an expected uncertain requirement into missing.
- **One denial is incorrectly supported.** In `v3-conflict-08`, CI/CD is listed but later expressly denied in a candidate clarification. The pipeline retains CI/CD as positive and marks it supported rather than uncertain. This is a remaining unsafe semantic decision, despite a valid parsed-data citation.
- **One third-party quote leaks two skills.** In `v3-conflict-11`, the quoted phrase “Our lead uses Rust and Kubernetes” belongs to another person. Rust and Kubernetes are incorrectly extracted and supported. These plus CI/CD are all three unsupported decisions; no false-supported formatting decisions occurred.
- **Semicolon-separated preferred clauses can change category.** `v3-format-05` loses the preferred category for Jest and GraphQL after the first preferred clause. The report preserves the resulting two missed and two extra category/skill pairs.
- **Contact representation remains incomplete.** Eight name/email fields are wrong across v3, including combined accented resume titles, alternative contact labels, reference context and later prose. The error list identifies every affected case. Exact source case is preserved, but that alone does not ensure correct identity recovery.
- **Coverage is narrower than a full resume assessment.** Role/company/date/qualification placement, visual formatting, OCR, experience and constraint correctness, live-provider behavior, multilingual inputs and human scoring agreement are not established by these labels. Import review remains necessary, especially where statements were placed in the summary.

The next accuracy cycle should promote these now-public v3 failures to regression cases, add the missing semantic/attribution rules with tests, and reserve another independent holdout before making a further generalization claim. This publication preserves the current failures without tuning on v3.

## Verification and reproduction

The final application implementation passed **232/232 server tests** and **49/49 client tests**, including real local database/API flows, conflict persistence/editing, adaptive interview behavior and learning-plan evidence links. Independent code review uncovered additional quote/denial bugs before the freeze; focused regressions cover those corrections. The later structural-only v2/v3/protocol checks passed **4/4**, without executing predictions or changing application source.

Known-set regression commands, from the repository root:

```bash
node server/scripts/evaluatePhase4.cjs --all --output .test-tmp/phase4-v4-v1.json
node server/scripts/evaluatePhase4.cjs --dataset-version v2 --holdout --output .test-tmp/phase4-v4-v2.json
```

The following was executed **once** after freeze; repeating it is blocked:

```bash
node server/scripts/evaluatePhase4.cjs --dataset-version v3 --holdout --first-pass server/evaluation/protocols/v3-first-pass.lock.json --output docs/PHASE4_ACCURACY_V3_HOLDOUT_RESULTS.json
```

After this publication, a v3 rerun is regression-only and must use a different output path:

```bash
node server/scripts/evaluatePhase4.cjs --dataset-version v3 --holdout --output .test-tmp/phase4-v3-regression.json
```

Implementation SHA-256: `d3d202609d1c6d1640ffee866a972cd2fcc6238f0f813913a9a9fc2de3381c89`. Unchanged metrics SHA-256: `a8231f12d7a3d47a60eb766eb28ad927ff7b08fab9af3b3f5e17b28ec08cd643`. V3 dataset SHA-256: `daa02764c4d57803e5701e195c7cdd4ec0afefc74683b53b0cdbbf4bf35caff6`. Protocol/lock/receipt preserve the evaluator, review and report hashes.

All case-level missing/unexpected skills, contact-field failures and incorrect requirement statuses are in the raw JSON. The complete first-pass case summary follows.

| Case | Skill TP/FP/FN | Contact correct | Status correct | Unsupported supported |
| --- | ---: | ---: | ---: | ---: |
| v3-format-01 | 6/0/0 | 2/2 | 5/5 | 0/4 |
| v3-format-02 | 0/0/6 | 2/2 | 1/6 | 0/0 |
| v3-format-03 | 4/0/2 | 2/2 | 4/6 | 0/3 |
| v3-format-04 | 0/0/6 | 1/2 | 1/5 | 0/0 |
| v3-format-05 | 1/0/6 | 1/2 | 1/7 | 0/1 |
| v3-format-06 | 5/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-07 | 2/0/4 | 2/2 | 2/6 | 0/1 |
| v3-format-08 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-09 | 6/0/0 | 0/2 | 7/7 | 0/6 |
| v3-format-10 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-11 | 8/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-12 | 3/0/3 | 1/2 | 3/6 | 0/2 |
| v3-conflict-01 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-02 | 3/0/0 | 1/2 | 5/5 | 0/3 |
| v3-conflict-03 | 3/0/1 | 2/2 | 4/5 | 0/3 |
| v3-conflict-04 | 0/0/3 | 2/2 | 1/5 | 0/0 |
| v3-conflict-05 | 1/0/3 | 2/2 | 2/6 | 0/1 |
| v3-conflict-06 | 0/0/3 | 2/2 | 1/5 | 0/0 |
| v3-conflict-07 | 3/0/0 | 2/2 | 4/5 | 0/3 |
| v3-conflict-08 | 3/1/0 | 2/2 | 4/5 | 1/4 |
| v3-conflict-09 | 0/0/3 | 2/2 | 1/5 | 0/0 |
| v3-conflict-10 | 4/0/0 | 2/2 | 6/6 | 0/3 |
| v3-conflict-11 | 5/2/0 | 2/2 | 4/6 | 2/6 |
| v3-conflict-12 | 5/0/0 | 0/2 | 6/6 | 0/5 |
