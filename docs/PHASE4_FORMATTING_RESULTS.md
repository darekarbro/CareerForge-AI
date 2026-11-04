# Formatting parser regression results

Published 4 November 2026 (Asia/Kolkata). The [machine-readable rerun](PHASE4_FORMATTING_RESULTS.json) was generated at `2026-11-04T11:02:21.828Z` on Node.js 25.9.0, Windows x64. The [initial frozen report](PHASE4_EVALUATION_RESULTS.md) and its JSON remain unchanged.

This follow-up fixes three observed extraction failures: letter-spaced section headings, inline skill lists and combined name/email headers. It reruns the same 30 development and 10 separately stored holdout examples. **All examples and their original results are already published: this rerun is regression evidence, not a new unseen holdout evaluation.** Dataset hashes are unchanged, and no reference labels were edited.

## Formatting cases: before and after

| Metric across six development formatting cases | Initial | After fixes |
| --- | ---: | ---: |
| Skills recovered / expected | 10/14 | 14/14 |
| Skill recall | 71.43% | **100%** |
| Skill F1 | 83.33% | **100%** |
| Exact name/email fields | 11/12 | **12/12** |
| Requirement status accuracy | 13/17 (76.47%) | **17/17 (100%)** |
| Unsupported supported-skill decisions | 0/9 | 0/13 |

`formatting-04` now recognizes `S K I L L S` and `E X P E R I E N C E`, recovering Java and SQL with a match score of 100. `formatting-06` now recognizes `SKILLS | Python | SQL` and recovers Ava Stone from the combined name/email header. Its match score is 86: Python and SQL are supported while the preferred MySQL requirement correctly remains missing.

## Overall rerun

| Metric | Development (30) | Published holdout regression (10) |
| --- | ---: | ---: |
| Exact name/email fields | 60/60 | 20/20 |
| Resume skill precision / recall / F1 | 98.11% / 100% / **99.05%** | 100% / 100% / 100% |
| JD skill extraction F1 | 100% | 100% |
| Requirement status accuracy | 79/79 (100%) | 25/25 (100%) |
| Unsupported supported-skill decisions | 0/43 | 0/16 |
| Citation integrity | 104/104 | 42/42 |
| Supported requirements with valid evidence | 44/44 | 16/16 |
| All requirements with supported evidence | 44/82 (53.66%) | 16/25 (64%) |
| Local pipeline p50 / p95 | 0.653 / 2.300 ms | 0.497 / 1.115 ms |
| External provider requests / tokens / cost | 0 / 0 / $0 | 0 / 0 / $0 |
| Human scoring agreement | Not measured | Not measured |

The only remaining extraction mismatch is `misleading-06`: React remains in a skills list that contradicts “I do not know React.” Matching preserves the contradiction as **uncertain** and awards no supported credit. This change does not attempt to resolve that separate semantic issue.

## Parsing and regression coverage

- Heading recognition removes spacing only when matching an entire known section label. It supports ordinary spaces, tabs, nonbreaking spaces, multiword headings and trailing colons. Body text such as the project title `S Q L Browser` stays unchanged.
- Inline headings support colons, pipes, fullwidth pipes, tabs and spaced hyphens/en/em dashes. Skills retain punctuation such as C++, C#, .NET and Node.js. Subsequent experience, project, education and summary headings end the previous section, including headings with an empty payload.
- Inline payloads retain their full negation or instructional context before filtering. Regression tests check that contact headers and employer names remain outside skill evidence, including after an empty inline heading.
- Combined contact headers use explicit separators or email boundaries, preserve Unicode names and never derive a name from an email username. Ambiguous multiple-person headers remain unknown.

The new regression tests cover equivalent conventional/spaced layouts, source-text preservation, inline boundaries, empty inline headings, negation/instructions, combined contacts, Unicode names and ambiguous headers. Evaluation provenance now hashes the new contact parser helper and lists every implementation file included in that hash.

The full backend suite passed **171/171 tests**, with zero failures or skips. This includes seven formatting regressions, four contact regressions and the new evaluation-provenance regression. No frontend files or dependencies changed.

## Reproduce

```bash
npm run evaluate:phase4
npm run evaluate:phase4 -- --all --output docs/PHASE4_FORMATTING_RESULTS.json
node --require ./server/test/setup.cjs --test server/test/resumeFormatting.test.js server/test/resumeContact.test.js server/test/phase4Evaluation.test.js
npm --prefix server test
```

These are small synthetic raw-text tests. They do not establish general real-resume accuracy, arbitrary layout support, OCR/PDF reading-order quality, verified competence or live-provider reliability. Ambiguous names and unfamiliar headings can remain unknown. Latency uses one local sample per case after warmup; it is not a service-performance guarantee. Independent human scoring agreement remains unavailable.
