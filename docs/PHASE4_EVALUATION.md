# Reproducing Phase 4 quality measurements

Run from the repository root with Node.js and the installed server dependencies:

```bash
node server/scripts/evaluatePhase4.cjs
node server/scripts/evaluatePhase4.cjs --holdout
node server/scripts/evaluatePhase4.cjs --all --output .test-tmp/phase4-current-regression.json
```

The default evaluates only 30 development cases. The holdout option explicitly evaluates the separately stored 10 cases. Use development results while implementing; freeze the implementation before publishing holdout results. If holdout results inform a later fix, add a new holdout version rather than repeatedly tuning against this set. These commands make no network calls, read no `.env`, and use no applicant data. See the [dataset policy](../server/evaluation/README.md).

The original report is preserved in `PHASE4_EVALUATION_RESULTS.json`. Since that dataset and its original holdout results are now public, subsequent runs label their use as development/published-holdout regression evidence. The [formatting follow-up](PHASE4_FORMATTING_RESULTS.md) compares the same unchanged reference labels before and after the parsing fixes. A new generalization claim needs a new, independently reserved holdout; a rerun of published cases does not provide one.

The [contradictory-skill follow-up](PHASE4_CONTRADICTION_RESULTS.md) resolves the remaining listed-but-denied skill mismatch using assessment version 3. The earlier formatting report remains preserved. Current citation-integrity totals include both positive and denial evidence; denominator changes should not be interpreted as new supported skills.

## Fresh v2 holdout

The [untuned first-pass v2 report](PHASE4_FRESH_HOLDOUT_RESULTS.md) evaluates 24 newly authored formatting/contradiction cases after implementation, metric and reference-label freeze. It exposes much weaker generalization than the known v1 regressions: skill F1 21.57%, status accuracy 34.41%, and 2/8 false-supported decisions. The raw results, preregistration, dataset lock, author/reviewer attestations and completed receipt are preserved. The separate author and reviewer were agents without implementation/prediction access, not independent humans.

`--dataset-version v2` requires explicit `--holdout`. The initial run used `--first-pass` with its locked protocol; the recorded receipt prevents another initial-run claim. Since the cases are now public, future reproductions are regression-only and must preserve the first-pass output:

```bash
npm run evaluate:phase4 -- --dataset-version v2 --holdout --output .test-tmp/phase4-v2-regression.json
```

The default evaluator CLI and CI evaluation artifact remain v1 development only; the current server test suite additionally checks public v2/v3 cases as regressions. The original v2 publication used the frozen assessment code and metric definitions. Its labels were reviewed before execution and were not adjusted to predictions. Later fixes use these public failures as regression cases; the original first-pass records remain preserved.

## V4 accuracy cycle and fresh v3 validation

The [v4 accuracy report](PHASE4_ACCURACY_RESULTS.md) preserves its v1/v2 regression measurements and independently authored/reviewed v3 first pass. That single untuned v3 run reports skill F1 78.17%, status accuracy 66.91% and 3/68 unsupported supported decisions. Those failures were published without changing the frozen implementation or labels. The subsequent [v5 regression report](PHASE4_V3_REGRESSION_RESULTS.md) documents fixes informed by these public cases, with unchanged references/metrics and separate raw results. V3 is regression evidence for this later work.

The [v3 protocol](../server/evaluation/protocols/v3-first-pass.json), [dataset lock](../server/evaluation/protocols/v3-first-pass.lock.json), [receipt](../server/evaluation/protocols/v3-first-pass.receipt.json) and [raw report](PHASE4_ACCURACY_V3_HOLDOUT_RESULTS.json) preserve source/dataset/evaluator hashes and the first attempt. After publication, reruns require a separate output path and count as regression evidence:

```bash
npm run evaluate:phase4 -- --dataset-version v3 --holdout --output .test-tmp/phase4-v3-regression.json
```

The JSON output contains separate split summaries, group summaries, case-level errors, timestamps, dataset hashes, an implementation hash and runtime information. Preserve those details with published results. Latency is measured from the actual run, so it varies by machine and background activity. A single independent warmup precedes one timed parse-and-match sample per case. This is a small local benchmark, not a load or service latency test.

## Metric definitions

| Metric | Definition and scope |
| --- | --- |
| Contact extraction accuracy | Exact, trimmed name/email matches divided by labeled name/email fields, including correctly empty fields. |
| Resume skill extraction | Micro precision, recall and F1 of the deduplicated canonical skill set against explicit positive raw-input reference labels. Includes adversarial cases, not just ordinary resumes. |
| JD skill extraction | Micro precision, recall and F1 of `(required/preferred category, canonical skill)` pairs. Initial reference labels do not measure non-skill requirements or unknown technologies. |
| Requirement status accuracy | Correct `supported`, `missing` or `uncertain` decisions divided by labeled JD skills; an unextracted requirement is incorrect. |
| Unsupported claim rate | Supported skill decisions whose reference label is missing/uncertain, divided by supported decisions with a reference label. This checks original-input truth even when parsed skill lists contain mistakes. |
| Citation integrity | Quotes that occur in the exact cited parsed-data field divided by all positive and denial evidence citations. This checks provenance plumbing; a valid citation can still repeat a parser error or self-report. Denials do not earn positive coverage or score credit. |
| Supported claim evidence coverage | Supported requirements with at least one valid citation divided by supported requirements. |
| All requirement evidence coverage | Supported requirements with valid citations divided by all extracted requirements, including experience and constraints. This describes available evidence, not model accuracy. |
| Human scoring agreement | Mean absolute error and fraction within 10 points versus the mean independent human score for each reviewed case. Unavailable until actual human annotations are supplied. |
| Latency | Actual local raw-text extraction plus matching p50/p95/mean, excluding upload, queue, database, API, network and UI. |
| Provider cost | Actual billed provider requests/tokens/cost for this offline run: zero. Infrastructure and engineering cost are excluded; live-provider cost is unmeasured. |

Zero-denominator rates are `null`, not fabricated perfect scores. F1 uses the standard micro count formula `2 TP / (2 TP + FP + FN)`. Contact accuracy includes many empty fields, so skill F1 and group-level errors should be considered alongside it. No metric establishes technical proficiency, protected-characteristic fairness, real employer decisions or performance on real resumes. The initial fixture set is English-dominant, synthetic, small and related in structure across splits.

## Collect independent human reviews

The [v5 reviewer packet](PHASE4_HUMAN_REVIEW_PACKET.md) contains all 10 v1 holdout inputs and the scoring instructions. Give the packet and one copy of the [blank ballot](../server/evaluation/human-review.v5-holdout.ballot.json) to each of two reviewers. Keep their ratings independent. Once both ballots are complete, combine their `reviews` arrays into a copy of the same JSON document and save it as `.test-tmp/phase4-human-reviews.json`. Verify that both reviewers scored every case and that the combined document contains 20 scores. The holdout-only command below evaluates those ratings with the current rubric and writes a separate agreement report.

```bash
node server/scripts/evaluatePhase4.cjs --dataset-version v1 --holdout --human .test-tmp/phase4-human-reviews.json --output docs/PHASE4_HUMAN_REVIEW_RESULTS.json
```

As of 8 November 2026, both reviewer ballots are pending. Agreement remains unmeasured until their scores are supplied. The released packet contains the inputs and scoring rules so reviewers can work independently of the predictions.

Copy [the empty template](../server/evaluation/human-review.template.json). Give reviewers the original resume text, job description and [assessment rubric](ASSESSMENT_RUBRICS.md), with system predictions hidden. Ask for the same weighted requirement-evidence match score, and preserve review identity and time. Prefer at least two independent reviewers and adjudicate disagreements before treating results as a release gate. Reviewers must provide their own judgments; fixture annotations, AI output and deterministic predictions are not human reviews.

Each entry in `reviews` has this format (the score shown here is only a schema illustration, never included in published metrics):

```json
{
  "caseId": "graduate-01",
  "reviewerId": "assigned-reviewer-identifier",
  "reviewedAt": "2026-11-04T10:00:00Z",
  "matchScore": 75
}
```

Run:

```bash
node server/scripts/evaluatePhase4.cjs --all --human /path/to/human-reviews.json --output docs/PHASE4_HUMAN_REVIEW_RESULTS.json
```

The runner validates dataset/rubric versions, score bounds, case identifiers and duplicate case/reviewer pairs. Human origin remains a reviewer attestation; software cannot verify it. Scores from multiple reviewers are averaged per case before computing agreement, so multiply reviewed cases do not receive extra weight. Unreviewed cases are excluded, and reviewed-case/review counts remain visible. The repository contains no actual human score reviews; published initial agreement must remain **not measured**.

## Interpreting failures

The offline parser uses a limited dictionary and text headings. Source restrictions reject contact/employer names, instruction-like text and negative or aspirational statements; unfamiliar headings and flattened columns can still lose real evidence. Detected listed-but-denied skills are withheld from positive extraction and retained as uncertain review evidence. Indirect, multilingual or complex temporal contradictions can still be missed. Report any false supported decision even if every quote points to a real parsed field: citation integrity cannot independently establish that the original input supports a claim. Exact case-level errors in the JSON make these limitations inspectable instead of hiding them inside aggregate scores. See the [frozen initial results](PHASE4_EVALUATION_RESULTS.md) and [current contradiction regression](PHASE4_CONTRADICTION_RESULTS.md).

Live AI provider quality is a separate evaluation. This runner does not contact configured providers, infer their current pricing, or claim live-provider reliability from offline results. A later live experiment must preserve the same split boundaries, record provider/model/rubric versions, actual usage, observed latency, explicit data-sharing authorization, and real human review provenance.
