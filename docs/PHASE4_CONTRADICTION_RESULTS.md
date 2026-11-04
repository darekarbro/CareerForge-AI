# Contradictory skill regression results

Published 4 November 2026 (Asia/Kolkata). The [machine-readable evaluation](PHASE4_CONTRADICTION_RESULTS.json) was generated at `2026-11-04T11:29:40.222Z` on Node.js 25.9.0, Windows x64. The [initial benchmark](PHASE4_EVALUATION_RESULTS.md), [formatting follow-up](PHASE4_FORMATTING_RESULTS.md), their JSON reports and both v1 fixture files remain unchanged.

This fixes the last labeled extraction mismatch: `misleading-06` listed React in a skills section but later said “I do not know React.” The parser now withholds the contradictory skill from positive lists, retains both statements outside resume content for review, and keeps requirement matching **uncertain** with zero supported credit.

## Case behavior

| Observation | After formatting fixes | After contradiction fixes |
| --- | --- | --- |
| Extracted positive skills | React | Empty |
| Raw skill extraction false positives | 1 | **0** |
| Requirement status | Uncertain | **Uncertain** |
| Match score | 0 | **0** |
| Positive and denial evidence | Positive skill list and summary | Original claim preserved in review metadata; exact current denial cited separately |

The match is not upgraded to supported or silently changed to missing after removing React from positive skills. A denial without any positive claim remains missing. A conflict asks the candidate to clarify the source statements; it does not establish actual competence or inability.

## Published-case rerun

The same **30 development and 10 separately stored holdout examples** were rerun. **The v1 examples and prior results are already public, so both splits now supply regression evidence, not a fresh unseen holdout estimate.** No fixture text or reference label changed, and dataset hashes match the earlier reports.

| Metric | Development (30) | Published holdout regression (10) |
| --- | ---: | ---: |
| Contact name/email exact fields | 60/60 | 20/20 |
| Resume skills TP / FP / FN | 52 / 0 / 0 | 19 / 0 / 0 |
| Resume skill precision / recall / F1 | **100% / 100% / 100%** | **100% / 100% / 100%** |
| JD skill extraction F1 | 100% | 100% |
| Requirement status accuracy | 79/79 (100%) | 25/25 (100%) |
| Unsupported supported-skill decisions | 0/43 | 0/16 |
| Citation integrity, including denial evidence | 107/107 | 42/42 |
| Supported requirements with valid evidence | 44/44 | 16/16 |
| All requirements with supported evidence | 44/82 (53.66%) | 16/25 (64%) |
| Local pipeline p50 / p95 | 0.800 / 3.659 ms | 0.854 / 1.806 ms |
| External provider requests / tokens / cost | 0 / 0 / $0 | 0 / 0 / $0 |
| Independent human scoring agreement | Not measured | Not measured |

Development resume-skill F1 improves from **99.05% to 100%**. All recorded contact/skill/status errors in these 40 known cases are now empty. The six formatting cases retain 14/14 recovered skills. Citation counts now include `conflictingEvidence` denial quotes as well as positive claims; denial citations never earn supported-skill coverage or score credit.

## What changed

- Bounded English denial recognition ties statements to a particular skill and clause. Canonical aliases such as ReactJS/React.js behave consistently. Unrelated negation, “not only,” “no issues,” learning intentions and instruction-like lines do not cancel a listed skill.
- Contradicted canonical skills are excluded from every positive skill group and project technology list. Original narrative text remains intact. Summary line boundaries are preserved so an instructional line cannot erase a separate genuine denial.
- Read-only `skillConflicts` metadata retains original positive quotes and current denial paths. It survives strict source/tailored persistence, unrelated edits and history restores. References relocate after entry reordering or source selection; removed or corrected denials clear obsolete flags. Client-supplied metadata is ignored.
- Resume text, keyword scoring and positive tailored skill lists do not treat review metadata as skills. Previously saved contradictions are also detected on review and reassessment. Warnings track current evidence after corrections and restores.
- Source comparison and requirement matching display the positive claim and denial separately. The original claim is labeled as withheld pending review.
- The assessment version is now `careerforge-assessment-v3` with engine `assessment-rules-v3`, invalidating earlier cache fingerprints. The scoring weights and formula remain unchanged. Evaluation fingerprints include the evidence, denial and conflict-resolution modules.

## Validation and reproduction

**193 backend tests and 49 frontend tests passed**, with zero failures or skips. This includes 22 new backend regressions and two new UI regressions: denial scope/aliases, order independence, unrelated skills, metadata provenance, strict persistence, legacy records, corrections, history, source selections and visible evidence. ESLint and the production frontend build also passed.

```bash
npm run evaluate:phase4
npm run evaluate:phase4 -- --all --output docs/PHASE4_CONTRADICTION_RESULTS.json
npm --prefix server test
npm --prefix client test
npm run lint
npm run build
```

These results concern known, small synthetic raw-text fixtures. They do not establish broad semantic accuracy, arbitrary temporal or indirect negation handling, multilingual reliability, OCR/layout accuracy, live LLM quality or hiring outcomes. The denial recognizer is a bounded heuristic, and original claims still require human review. Latency measures one local sample per case after warmup, excluding upload, queue/database, API/UI and network. Human scoring agreement remains unmeasured.
