# Phase 4 assessment evaluation

The versioned `dataset/v1` files contain **40 synthetic cases**: 30 development cases and 10 separate holdout cases. Each split contains graduates, experienced candidates, sparse resumes, unusual text formatting, and misleading inputs (six development and two holdout cases per group). Names, addresses and employers are fictional; no user data or consented resumes are included.

The fixture author wrote the expected labels independently of the application output. These are synthetic reference annotations, **not human reviewer assessments**. The extraction labels cover contact name/email and explicit positively asserted skills from the application's documented dictionary. Intention to learn, negation, contradictory claims, employer names, addresses and prompt instructions are not positive skill evidence. A literal skill mention is evidence of a self-report, not proof of proficiency. `expectedRequirements` covers labeled skill requirements; experience and constraint correctness is outside this initial gold annotation scope.

Formatting cases include CRLF, tabs, flattened columns, unusual headings, punctuation and Unicode. They test already extracted text, not PDF OCR, DOCX parsing or visual layout. Some fixtures deliberately expose known offline parser weaknesses; passing percentages must not be presented as proof of real hiring suitability.

Holdout cases are stored separately and must not drive implementation tuning. Use development cases during changes. Run holdout explicitly only when publishing a frozen result, report both splits separately, and create a new holdout version if results inform later tuning. This small, related synthetic set is not a representative sample of real applicants or an externally blinded benchmark.

The v1 cases and initial results are now public. Later runs of this set are labeled regression checks, including the published holdout split. The formatting follow-up preserves both v1 JSON datasets and the initial report; it does not claim fresh unseen evaluation evidence.

Human score agreement is unavailable until independent reviewers supply annotations. Do not substitute fixture scores, AI scores or deterministic expected scores for human judgments. The measurement guide documents the annotation format and runner.

## Fresh v2 first pass

`dataset/v2/holdout.json` adds 24 newly authored, fictional cases: 12 formatting and 12 contradictory-skills cohort cases (nine conflicts, three controls). A separate agent authored them without implementation or prior-fixture access, and another agent semantically reviewed the labels without implementation or prediction access. Their attestations are stored alongside the data. This is agent review, not human review or an externally administered benchmark.

The [preregistered protocol](protocols/v2-first-pass.json) freezes assessment and metric hashes before authoring; the [lock](protocols/v2-first-pass.lock.json) freezes dataset/review/evaluator hashes before scoring. A single initial scored run is preserved in the [receipt](protocols/v2-first-pass.receipt.json) and [report](../../docs/PHASE4_FRESH_HOLDOUT_RESULTS.md). That original publication used the unchanged frozen implementation. Structural validation tests read the references but never execute predictions on them.

The initial v2 result is skill F1 21.57%, requirement-status accuracy 34.41%, and 2/8 unsupported supported-skill decisions. Publication now makes v2 a known regression set. Select it explicitly with `--dataset-version v2 --holdout`; later runs are labeled regression-only. The default evaluator CLI and CI evaluation artifact still use v1 development. The v4 server test suite also checks public v2 cases as regressions. Preserve all first-pass reports and reserve another new holdout before claiming that a future fix generalizes.

## Accuracy cycle and independent v3 validation

Assessment v4 fixes the known v2 extraction/contradiction failures, with 100% skill F1 and requirement-status accuracy on those public regression cases. Labels, metrics and earlier reports remain unchanged. V2 contact exact match is 47/48 because source capitalization is preserved. See the [accuracy report](../../docs/PHASE4_ACCURACY_RESULTS.md) and separate v1/v2 raw regression measurements.

`dataset/v3/holdout.json` contains another 24 fictional cases, independently authored and separately blind-reviewed without implementation, earlier fixture or prediction access. Case contents were withheld from implementation agents during the v2-informed fixes. The improved code, reviewed labels and unchanged metrics were [frozen](protocols/v3-first-pass.json) and [locked](protocols/v3-first-pass.lock.json) before the single initial execution. The [receipt](protocols/v3-first-pass.receipt.json) and [raw report](../../docs/PHASE4_ACCURACY_V3_HOLDOUT_RESULTS.json) preserve that run. The original publication used that unchanged frozen implementation and labels.

V3 first-pass skill F1 is 78.17%, requirement-status accuracy 66.91%, contact exact match 40/48, and unsupported supported decisions 3/68. The publication describes all errors and remaining scope limits. It does not replace absent human reviews or measure live LLM/OCR quality. `--dataset-version v3 --holdout` now permits regression runs to a new output path; the frozen first-pass output cannot be overwritten. V3 is public from this publication onward and must not be reused as unseen evidence.

## V3 regression repairs

Assessment v5 uses the now-public v3 failures to improve compact declarations, tables, contact labels, bounded denials, third-party/source ownership and JD category inheritance. The [v3 regression report](../../docs/PHASE4_V3_REGRESSION_RESULTS.md) records the new measurements separately from the preserved first pass. All reference labels and metric definitions remain unchanged. V1/v2 are also rerun to check for regressions; these runs provide no new unseen generalization evidence.

The server suite now checks every public v3 case for exact contacts, skills, requirement categories/statuses, provider validation, citation validity and stable conflict reconciliation. Additional controls cover copied/reference sections, article-bearing denials and assertion order. The evaluator CLI and CI evaluation artifact still default to v1 development; the complete server test suite additionally runs public v2/v3 regression cases.
