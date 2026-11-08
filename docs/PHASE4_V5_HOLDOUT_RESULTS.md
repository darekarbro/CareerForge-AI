# Fresh holdout results for assessment v5

The frozen v5 engine scored **78.14% skill F1** and classified **116 of 164 skill requirements correctly (70.73%)** on 30 new fictional cases. It gave credit to **10 of 89 labeled positives** whose references called for missing or uncertain status. It matched **37 of 60 contact fields** exactly. [Raw results](PHASE4_V5_HOLDOUT_RESULTS.json)

## First-pass protocol

The dataset is version v4 and the assessment engine is v5. The five groups contain six cases each, covering graduates, experienced candidates, sparse resumes, formatting and misleading inputs. One agent authored the sources and reference labels without access to the implementation or prior cases. A separate agent reviewed the 30 cases and 164 requirement references and clarified one fixture before freeze. [Dataset](../server/evaluation/dataset/v4/holdout.json) · [Authoring record](../server/evaluation/dataset/v4/AUTHORING.md) · [Label review](../server/evaluation/dataset/v4/LABEL_REVIEW.md)

The protocol fixed the implementation fingerprint from the published v5 engine, case counts, measures and first-pass policy before scoring. Commit `570fedf` recorded the dataset and lock. The evaluator checked the implementation, metrics, dataset and evaluator hashes and issued a single completed receipt for 30 cases. Commit `9b2cb37` preserved the results of that run. [Protocol](../server/evaluation/protocols/v4-first-pass.json) · [Lock](../server/evaluation/protocols/v4-first-pass.lock.json) · [Receipt](../server/evaluation/protocols/v4-first-pass.receipt.json)

## Results by case group

| Group | Exact contacts | Skill TP / FP / FN | Skill F1 | Correct requirement statuses | Unsupported among labeled positives |
| --- | ---: | ---: | ---: | ---: | ---: |
| Graduate | 9/12 | 20 / 2 / 7 | 81.63% | 26/35 | 2/21 |
| Experienced | 8/12 | 24 / 1 / 15 | 75.00% | 27/43 | 1/22 |
| Sparse | 12/12 | 8 / 0 / 1 | 94.12% | 19/20 | 0/8 |
| Formatting | 2/12 | 16 / 2 / 7 | 78.05% | 20/31 | 2/17 |
| Misleading | 6/12 | 16 / 6 / 6 | 72.73% | 24/35 | 5/21 |
| **All 30** | **37/60** | **84 / 11 / 36** | **78.14%** | **116/164** | **10/89** |

Skill precision was **88.42%** and recall was **70.00%**. Job-description skill extraction recovered 162 of 164 category and skill pairs and added two extra pairs, for **98.78% F1**. All **283/283** citations resolved to the stated parsed field. All **90/90** supported requirements had at least one valid citation, which covered **90/172** classified requirements across all categories. The 89-decision denominator in the table counts supported skill decisions with a reference label. [Case and group measurements](PHASE4_V5_HOLDOUT_RESULTS.json)

## Failure patterns

- **Contact layouts.** The formatting group matched two of twelve contact fields exactly. The 23 contact mismatches across all groups comprised 13 names and 10 emails. `v4-formatting-harbor-simulation` uses dotted leader form labels for both contact fields and missed both. `v4-formatting-archive-checksums` uses a keyed applicant section and missed the candidate name.
- **Candidate work in unfamiliar structures.** `v4-experienced-instrument-shop` lost PHP, Laravel, MySQL, Redis and Git from explicit work statements. `v4-formatting-archive-checksums` lost the skills in its keyed work-sample section. The experienced group accounted for 15 of 36 missed skill labels.
- **Ownership and denial.** Eight of the ten unsupported decisions credited third-party work. `v4-formatting-heating-meter` assigned MongoDB and Redis from the separate billing team's column to the candidate. `v4-misleading-warranty-migration` credited Kafka from a vendor plan despite a personal denial. `v4-misleading-gallery-refresh` credited JavaScript despite conflicting personal statements. A valid citation can point to a parsed field even when its evidence belongs to someone else or conflicts with another statement.
- **Requirement categories.** The bracketed headings in `v4-formatting-harbor-simulation` led the extractor to classify Python and Java as required. Both appear under the preferred heading in the source, accounting for the two extra and two missing category and skill pairs. [Source cases](../server/evaluation/dataset/v4/holdout.json) · [Decision errors](PHASE4_V5_HOLDOUT_RESULTS.json)

The sparse group had the strongest skill F1 and status results. The misleading group accounted for five of the ten unsupported supported decisions. The published v3 regression results remain useful for known cases. The fresh v4 results show where the same engine needs additional work on unfamiliar inputs. [V5 known-case regression](PHASE4_V3_REGRESSION_RESULTS.md)

## Timing and scope

The first pass ran on 8 November 2026 from 11:57:49 to 11:57:50 IST using Node.js v25.9.0 on Windows x64. One timed parse and match per case after warmup gave p50 **43.431 ms**, p95 **79.233 ms** and mean **39.855 ms**. Timing covers local raw-text processing. The offline run made zero provider requests, used zero billed tokens and incurred zero external model cost. [Run receipt](../server/evaluation/protocols/v4-first-pass.receipt.json)

This run covers fictional English raw text and a finite skill vocabulary. Separate reports cover experience and constraint judgments, interview quality and live provider behavior. The human scoring agreement study uses the 10 published v1 holdout cases and awaits two independent ballots. [Expanded evaluation](PHASE4_EXPANDED_VALIDATION.md) · [Live evaluation](PHASE4_LIVE_VALIDATION.md) · [Human reviewer packet](PHASE4_HUMAN_REVIEW_PACKET.md)

## Reproduction

The recorded first pass used the locked command below. The receipt and existing output protect that run from replacement.

```powershell
node server/scripts/evaluatePhase4.cjs --dataset-version v4 --holdout --first-pass server/evaluation/protocols/v4-first-pass.lock.json --output docs/PHASE4_V5_HOLDOUT_RESULTS.json
```

Use a separate path for regression runs on the published cases.

```powershell
node server/scripts/evaluatePhase4.cjs --dataset-version v4 --holdout --output .test-tmp/phase4-v4-regression.json
```
