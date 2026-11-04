# Phase 4 assessment evaluation

The versioned `dataset/v1` files contain **40 synthetic cases**: 30 development cases and 10 separate holdout cases. Each split contains graduates, experienced candidates, sparse resumes, unusual text formatting, and misleading inputs (six development and two holdout cases per group). Names, addresses and employers are fictional; no user data or consented resumes are included.

The fixture author wrote the expected labels independently of the application output. These are synthetic reference annotations, **not human reviewer assessments**. The extraction labels cover contact name/email and explicit positively asserted skills from the application's documented dictionary. Intention to learn, negation, contradictory claims, employer names, addresses and prompt instructions are not positive skill evidence. A literal skill mention is evidence of a self-report, not proof of proficiency. `expectedRequirements` covers labeled skill requirements; experience and constraint correctness is outside this initial gold annotation scope.

Formatting cases include CRLF, tabs, flattened columns, unusual headings, punctuation and Unicode. They test already extracted text, not PDF OCR, DOCX parsing or visual layout. Some fixtures deliberately expose known offline parser weaknesses; passing percentages must not be presented as proof of real hiring suitability.

Holdout cases are stored separately and must not drive implementation tuning. Use development cases during changes. Run holdout explicitly only when publishing a frozen result, report both splits separately, and create a new holdout version if results inform later tuning. This small, related synthetic set is not a representative sample of real applicants or an externally blinded benchmark.

The v1 cases and initial results are now public. Later runs of this set are labeled regression checks, including the published holdout split. The formatting follow-up preserves both v1 JSON datasets and the initial report; it does not claim fresh unseen evaluation evidence.

Human score agreement is unavailable until independent reviewers supply annotations. Do not substitute fixture scores, AI scores or deterministic expected scores for human judgments. The measurement guide documents the annotation format and runner.

## Fresh v2 first pass

`dataset/v2/holdout.json` adds 24 newly authored, fictional cases: 12 formatting and 12 contradictory-skills cohort cases (nine conflicts, three controls). A separate agent authored them without implementation or prior-fixture access, and another agent semantically reviewed the labels without implementation or prediction access. Their attestations are stored alongside the data. This is agent review, not human review or an externally administered benchmark.

The [preregistered protocol](protocols/v2-first-pass.json) freezes assessment and metric hashes before authoring; the [lock](protocols/v2-first-pass.lock.json) freezes dataset/review/evaluator hashes before scoring. A single initial scored run is preserved in the [receipt](protocols/v2-first-pass.receipt.json) and [report](../../docs/PHASE4_FRESH_HOLDOUT_RESULTS.md). No application, metric or label tuning followed that run. Structural validation tests read the new references but never execute predictions on them.

The initial v2 result is skill F1 21.57%, requirement-status accuracy 34.41%, and 2/8 unsupported supported-skill decisions. Publication now makes v2 a known regression set. Select it explicitly with `--dataset-version v2 --holdout`; later runs are labeled regression-only. Default CLI and CI behavior still use v1 development. Preserve all first-pass reports and reserve another new holdout before claiming that a future fix generalizes.
