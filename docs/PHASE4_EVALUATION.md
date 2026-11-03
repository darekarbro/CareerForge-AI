# Reproducing Phase 4 quality measurements

Run from the repository root with Node.js and the installed server dependencies:

```bash
node server/scripts/evaluatePhase4.cjs
node server/scripts/evaluatePhase4.cjs --holdout
node server/scripts/evaluatePhase4.cjs --all --output docs/PHASE4_EVALUATION_RESULTS.json
```

The default evaluates only 30 development cases. The holdout option explicitly evaluates the separately stored 10 cases. Use development results while implementing; freeze the implementation before publishing holdout results. If holdout results inform a later fix, add a new holdout version rather than repeatedly tuning against this set. These commands make no network calls, read no `.env`, and use no applicant data. See the [dataset policy](../server/evaluation/README.md).

The JSON output contains separate split summaries, group summaries, case-level errors, timestamps, dataset hashes, an implementation hash and runtime information. Preserve those details with published results. Latency is measured from the actual run, so it varies by machine and background activity. A single independent warmup precedes one timed parse-and-match sample per case. This is a small local benchmark, not a load or service latency test.

## Metric definitions

| Metric | Definition and scope |
| --- | --- |
| Contact extraction accuracy | Exact, trimmed name/email matches divided by labeled name/email fields, including correctly empty fields. |
| Resume skill extraction | Micro precision, recall and F1 of the deduplicated canonical skill set against explicit positive raw-input reference labels. Includes adversarial cases, not just ordinary resumes. |
| JD skill extraction | Micro precision, recall and F1 of `(required/preferred category, canonical skill)` pairs. Initial reference labels do not measure non-skill requirements or unknown technologies. |
| Requirement status accuracy | Correct `supported`, `missing` or `uncertain` decisions divided by labeled JD skills; an unextracted requirement is incorrect. |
| Unsupported claim rate | Supported skill decisions whose reference label is missing/uncertain, divided by supported decisions with a reference label. This checks original-input truth even when parsed skill lists contain mistakes. |
| Citation integrity | Quotes that occur in the exact cited parsed-data field divided by all evidence citations. This checks provenance plumbing; a valid citation can still repeat a parser error or self-report. |
| Supported claim evidence coverage | Supported requirements with at least one valid citation divided by supported requirements. |
| All requirement evidence coverage | Supported requirements with valid citations divided by all extracted requirements, including experience and constraints. This describes available evidence, not model accuracy. |
| Human scoring agreement | Mean absolute error and fraction within 10 points versus the mean independent human score for each reviewed case. Unavailable until actual human annotations are supplied. |
| Latency | Actual local raw-text extraction plus matching p50/p95/mean, excluding upload, queue, database, API, network and UI. |
| Provider cost | Actual billed provider requests/tokens/cost for this offline run: zero. Infrastructure and engineering cost are excluded; live-provider cost is unmeasured. |

Zero-denominator rates are `null`, not fabricated perfect scores. F1 uses the standard micro count formula `2 TP / (2 TP + FP + FN)`. Contact accuracy includes many empty fields, so skill F1 and group-level errors should be considered alongside it. No metric establishes technical proficiency, protected-characteristic fairness, real employer decisions or performance on real resumes. The initial fixture set is English-dominant, synthetic, small and related in structure across splits.

## Collect independent human reviews

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
node server/scripts/evaluatePhase4.cjs --all --human /path/to/human-reviews.json --output docs/PHASE4_EVALUATION_RESULTS.json
```

The runner validates dataset/rubric versions, score bounds, case identifiers and duplicate case/reviewer pairs. Human origin remains a reviewer attestation; software cannot verify it. Scores from multiple reviewers are averaged per case before computing agreement, so multiply reviewed cases do not receive extra weight. Unreviewed cases are excluded, and reviewed-case/review counts remain visible. The repository contains no actual human score reviews; published initial agreement must remain **not measured**.

## Interpreting failures

The offline parser scans a limited dictionary and can turn negations, intentions, organization names or injected instructions into skill-list entries. The requirement matcher can reject some contradictory narrative text but cannot always reconstruct the origin of an already parsed skill. Report those false supported decisions even if every quote points to a real parsed field. Unusual flattened headers can also lose contact names. Exact case-level errors in the JSON make these limitations inspectable instead of hiding them inside aggregate scores.

Live AI provider quality is a separate evaluation. This runner does not contact configured providers, infer their current pricing, or claim live-provider reliability from offline results. A later live experiment must preserve the same split boundaries, record provider/model/rubric versions, actual usage, observed latency, explicit data-sharing authorization, and real human review provenance.
