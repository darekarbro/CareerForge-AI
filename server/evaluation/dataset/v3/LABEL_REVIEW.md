# Blind semantic label review

Review date: 2026-11-04

## Independence and scope

An independent reviewer read only `holdout.json` and `AUTHORING.md` before writing this record. No application implementation, earlier dataset, fixture, test, prediction, evaluation report, or model output was inspected. No application or model was executed. Standalone JSON inspection was used only to count annotations and check source-string and label consistency.

All 24 cases were reviewed individually from the resume and job-description text. The review covered candidate identity and email, positive skill attribution and alias normalization, explicit personal contradictions, requirement category and status, ambiguity, and originality within this set.

## Decision

Accepted without corrections: **24 of 24 cases**. Objectively wrong labels found: **0**. Label changes: **0**. Resume, job-description, and annotation-note changes: **0**. The source holdout was left unchanged.

The review applied the supplied annotation rule: exact-source contact values; positive self-reported skills only; an explicit positive claim together with an explicit personal denial causes the skill to be withheld from extraction and a requested requirement to be uncertain; denial alone, a noncandidate statement, or aspiration does not establish candidate evidence. An explicit later correction does not erase the earlier positive statement for this dataset's conflict annotation.

## Review coverage and findings

| Review unit | Reviewed | Accepted | Corrections |
| --- | ---: | ---: | ---: |
| Formatting cases | 12 | 12 | 0 |
| Contradictory-skills cases | 12 | 12 | 0 |
| Exact-source candidate names | 24 | 24 | 0 |
| Exact-source candidate emails | 24 | 24 | 0 |
| Positive extraction skill labels | 117 | 117 | 0 |
| Job requirement annotations | 136 | 136 | 0 |

The contradictory-skills cohort contains nine actual candidate conflicts and three controls. All nine conflicts have both an explicit positive candidate statement and an explicit personal denial. Each conflicted skill is withheld from positive extraction, and its requested requirement is uncertain. The controls preserve the distinction between denial alone, another person's statement, and unrelated negation.

Every positive extraction label has candidate-attributed support in the resume. Ordinary list headings, experience statements, wrapped lists, and table-like layouts remain clear positive claims. Employer and reference text is not incorrectly attributed to the candidate. Contact labels and surrounding text resolve identity without guessing; capitalization, accents, and name particles are preserved.

Every job requirement is assigned to its stated required or preferred category. Supported annotations agree with positive extraction; missing annotations have no uncontradicted positive candidate evidence; uncertain annotations correspond to the explicit conflicts. The 136 requirement annotations comprise 100 supported, 27 missing, and nine uncertain entries. No material semantic ambiguity remains under the supplied policy.

## Originality and limits

All 24 resume strings, job-description strings, candidate names, and candidate emails are distinct within the set. Manual comparison found no duplicate or substantially repeated complete case. The set varies layout, attribution context, and evidence expression, while the nine conflict cases intentionally share the positive-claim-plus-denial structure needed for their cohort. These are related synthetic probes, not 24 statistically independent samples of real resumes.

Originality was assessed only within these 24 cases. Independence from prior datasets rests on the author's access record; no prior material was opened for comparison. This review does not establish population coverage, real-world prevalence, or model accuracy. Aspiration-only and copied-instruction behavior is part of the annotation policy but is not separately represented by a dedicated control in this set.

## Change log

No corrections were necessary. The reviewer created only this review record and did not stage or commit any file.
