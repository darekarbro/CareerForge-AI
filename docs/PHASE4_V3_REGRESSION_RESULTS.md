# V3 regression repairs: assessment v5

This follow-up fixes the published v3 failures using unchanged reference labels and metric definitions. The new run is **regression evidence**: v3 informed the implementation and is no longer unseen. The [original untuned first-pass report](PHASE4_ACCURACY_V3_HOLDOUT_RESULTS.json), [publication](PHASE4_ACCURACY_RESULTS.md), dataset, protocol, lock and receipt are preserved.

## Fixes and regression coverage

- **Three unsupported decisions:** coordinated CI/CD build/operate denials, tooling/pipeline suffixes and article-bearing targets now withhold the contradicted skill. Quoted claims from a lead, supervisor or mentor cannot establish candidate ownership. CI/CD is uncertain in the conflicting case; Rust and Kubernetes are missing in the third-party case.
- **Missed skills:** compact declarations such as `TOOLBOX //`, bracket lists, category/value tables, cloud/application/tooling labels, wrapped work-kit/strengths lists, trained-project contributions and foundations statements retain candidate evidence. Category cells are excluded from capability evidence.
- **Missed conflicts:** compact skill-first denials such as `Kafka: no experience` and correction/clarification boundaries preserve both the positive claim and denial for review. Negative outcomes such as “no outages” do not deny competence.
- **Contacts:** document titles, accented résumé labels, alternate email labels and availability prose are handled without inventing identities, changing source case or accepting reference addresses.
- **Job requirements:** an inline preferred/required heading governs its semicolon-separated list until a new heading. Qualifiers elsewhere in prose remain clause-scoped, and instructions cannot change inherited categories.
- **Review-discovered safeguards:** explicit reference/copied-JD ownership persists through nested compact lists, bracket rows and tables. Copied first-person claims and denials remain external until a clear personal/career boundary. Repeated conflict reconciliation preserves still-active original evidence after generated technology lists are withheld.

Every v3 case now has a [regression test](../server/test/v3AccuracyRegression.test.js) for exact contacts, positive skills, JD categories/statuses, provider schema validation, valid citations and stable conflict evidence. Additional variants reverse assertion order, wrap quoted statements, vary delimiters/CRLF, and test unrelated negation, aspirations, copied material, competing identities and genuine personal evidence. The final assessment engine is `assessment-rules-v5`, rubric `careerforge-assessment-v5`; the version change invalidates prior cache fingerprints. Score weights are unchanged.

## Measured results

| Metric | Original v3 first pass, v4 | V3 regression, v5 | Formatting (12), v5 | Conflict cohort (12), v5 |
| --- | ---: | ---: | ---: | ---: |
| Cases | 24 | 24 | 12 | 12 |
| Contact exact fields | 40/48 (83.33%) | 48/48 (100.00%) | 24/24 (100.00%) | 24/24 (100.00%) |
| Skill TP / FP / FN | 77 / 3 / 40 | 117 / 0 / 0 | 74 / 0 / 0 | 43 / 0 / 0 |
| Skill precision | 96.25% | 100.00% | 100.00% | 100.00% |
| Skill recall | 65.81% | 100.00% | 100.00% | 100.00% |
| Skill F1 | 78.17% | 100.00% | 100.00% | 100.00% |
| JD category/skill TP / FP / FN | 134 / 2 / 2 | 136 / 0 / 0 | 72 / 0 / 0 | 64 / 0 / 0 |
| JD category/skill F1 | 98.53% | 100.00% | 100.00% | 100.00% |
| Requirement status accuracy | 91/136 (66.91%) | 136/136 (100.00%) | 72/72 (100.00%) | 64/64 (100.00%) |
| Unsupported supported decisions | 3/68 | 0/100 | 0/60 | 0/40 |
| Citation integrity | 186/186 | 242/242 | 130/130 | 112/112 |
| Supported requirements with valid evidence | 68/68 | 100/100 | 60/60 | 40/40 |
| All requirement evidence coverage | 68/136 (50.00%) | 100/136 (73.53%) | 60/72 (83.33%) | 40/64 (62.50%) |

All 24 v3 case-level failure arrays are empty. All nine actual conflicts are uncertain and earn no match credit; the remaining reference outcomes are 100 supported and 27 missing. The original 40 missed skills and three falsely positive skills are resolved.

| Regression split | Skill F1 | JD category/skill F1 | Correct requirement statuses | Contact fields | Unsupported supported decisions |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 development (30) | 100.00% | 100.00% | 79/79 | 60/60 | 0/43 |
| V1 published holdout (10) | 100.00% | 100.00% | 25/25 | 20/20 | 0/16 |
| V2 published holdout (24) | 100.00% | 100.00% | 93/93 | 47/48 | 0/57 |


The first pass used v4 on unseen cases. The v5 measurements use these same now-public cases after fixing their failures. This paired comparison demonstrates regression repair, not new generalization. Counts are per case-skill pair; citation counts can change as more evidence is recovered, so a larger citation denominator is not itself an accuracy improvement.

Raw files: [v3 regression](PHASE4_V3_REGRESSION_RESULTS.json), [v1 regression](PHASE4_V3_REGRESSION_V1_RESULTS.json), [v2 regression](PHASE4_V3_REGRESSION_V2_RESULTS.json). All per-case failure arrays, group summaries, dataset/source/evaluator/metric hashes and actual latency samples are included. The v2 name casing convention remains unchanged: source `MARIN VELL` is preserved against reference `Marin Vell`.

Evaluated at `2026-11-04T17:36:02.890Z` after application commit `8f58525`, on v25.9.0, win32 x64. The repository targets Node 24; this local run used the recorded Node 25 runtime. V3 local raw-text parse-plus-match latency was p50 **11.941 ms**, p95 **19.417 ms**, mean **11.905 ms**. Each case has one timed sample after a separate warmup; this is not a service/load benchmark and excludes upload, OCR, queue, database, API/UI and network time.

Implementation SHA-256: `8e1e1cce20886140c5a330b0a688b06e277c09042352ba2befcb0f59c23a377e`. Unchanged metric definitions SHA-256: `a8231f12d7a3d47a60eb766eb28ad927ff7b08fab9af3b3f5e17b28ec08cd643`. V3 dataset SHA-256: `daa02764c4d57803e5701e195c7cdd4ec0afefc74683b53b0cdbbf4bf35caff6`. Raw reports record the evaluator fingerprint and all evaluated split hashes.

## Verification and reproduction

The final implementation passed **283/283 server tests** and **49/49 client tests**. Server validation includes real local database/API flows, source and tailored conflict persistence, edits/restores, cache versioning, interview adaptation and learning-plan evidence. Independent integration review found the copied-source/article-bearing-denial cases; both have dedicated end-to-end regressions and passed read-only verification after correction.

Separate commits cover JD inheritance, contacts, versioning, skill semantics, layouts, conflict stability, corpus regressions, ownership safeguards and measurements. Existing v1/v2/v3 datasets and historical reports were not relabeled or overwritten. The default evaluator CLI/CI artifact remains v1 development; the full server suite now also checks the public v2/v3 regression sets.

From the repository root, use separate outputs for future reproductions:

```bash
node server/scripts/evaluatePhase4.cjs --all --output .test-tmp/v5-v1-regression.json
node server/scripts/evaluatePhase4.cjs --dataset-version v2 --holdout --output .test-tmp/v5-v2-regression.json
node server/scripts/evaluatePhase4.cjs --dataset-version v3 --holdout --output .test-tmp/v5-v3-regression.json
```

No new holdout was scored in this follow-up. These small, synthetic, English-dominant cases do not establish accuracy on new resumes, complex ownership/temporal language, multilingual text, visual layout/OCR, experience/constraint judgments, live AI providers or hiring outcomes. V2/v3 labels have separate agent author/reviewer records; they are not human scoring reviews. Independent human score agreement remains **not measured**. External requests, billed tokens and external model cost for these offline evaluations are zero; infrastructure and engineering costs are excluded.

## Complete v3 case summary

| Case | Skill TP/FP/FN | Contact correct | Status correct | Unsupported supported |
| --- | ---: | ---: | ---: | ---: |
| v3-format-01 | 6/0/0 | 2/2 | 5/5 | 0/4 |
| v3-format-02 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-03 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-04 | 6/0/0 | 2/2 | 5/5 | 0/4 |
| v3-format-05 | 7/0/0 | 2/2 | 7/7 | 0/6 |
| v3-format-06 | 5/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-07 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-08 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-09 | 6/0/0 | 2/2 | 7/7 | 0/6 |
| v3-format-10 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-11 | 8/0/0 | 2/2 | 6/6 | 0/5 |
| v3-format-12 | 6/0/0 | 2/2 | 6/6 | 0/5 |
| v3-conflict-01 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-02 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-03 | 4/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-04 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-05 | 4/0/0 | 2/2 | 6/6 | 0/4 |
| v3-conflict-06 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-07 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-08 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-09 | 3/0/0 | 2/2 | 5/5 | 0/3 |
| v3-conflict-10 | 4/0/0 | 2/2 | 6/6 | 0/3 |
| v3-conflict-11 | 5/0/0 | 2/2 | 6/6 | 0/4 |
| v3-conflict-12 | 5/0/0 | 2/2 | 6/6 | 0/5 |
