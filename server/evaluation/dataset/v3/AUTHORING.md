# Independent v3 holdout authoring record

This holdout was authored by an independent agent before any model execution against these cases. All 24 examples, candidate identities, employers, and contact addresses are fictional. The addresses use the reserved .invalid domain.

## Independence and access

- No application implementation was read, imported, or executed.
- No existing fixtures, tests, datasets, evaluation reports, or model predictions were read.
- No application, evaluation, or model run was performed while authoring.
- The only authored or read artifacts for this assignment are the new v3/holdout.json and this AUTHORING.md. Exact-path existence checks were used only to verify that these two artifacts did not already exist.
- The cases were composed from ordinary resume and job-description language using only the task's public canonical vocabulary and supplied aliases. They were not tailored to an observed parser or scorer.
- Case text is withheld from the implementation author until the improved implementation is frozen. Blind review may inspect these artifacts before scoring.

## Composition

The dataset contains exactly 24 cases: 12 in formatting and 12 in contradictory_skills. Layouts range from conventional resumes to alternate headings, table-like columns, delimiter lists, wrapped prose, and clearly labeled contact fields. The formatting cohort includes ordinary examples as well as moderately difficult layouts.

The contradictory_skills cohort contains exactly nine actual candidate skill-conflict cases (v3-conflict-01 through v3-conflict-09), each with one explicit positive candidate skill claim and an explicit denial of that same skill. It also contains exactly three controls: denial-only (v3-conflict-10), a third-party statement (v3-conflict-11), and unrelated negation (v3-conflict-12). The controls have no actual candidate skill conflict.

## Annotation convention

Contact names and emails use the exact source spelling and case. Uppercase names are not title-cased, accents and name particles are retained, and each case has an unambiguous candidate identity. Cases requiring an identity guess were not included.

Positive extraction includes all explicit positive candidate skills in the permitted canonical vocabulary. The supplied aliases are normalized to their canonical labels. An explicitly contradicted candidate skill is excluded from positive extraction; if requested by the job, its status is uncertain. A denial-only skill is missing. A skill mentioned only as another person's ability, an employer name, an instruction, or an aspiration is not positive candidate evidence. Required and preferred categories follow each job description.

## Checks and limits

Only structural and annotation-consistency checks were performed: JSON validity; schema fields; case counts and IDs; the permitted vocabulary; valid categories and statuses; duplicate-free labels; exact-source contact strings; and consistency between positive extraction and supported/missing/uncertain statuses. No accuracy score was calculated.

These are small, synthetic English-language examples. They do not represent real users, real consented resumes, population prevalence, multilingual coverage, or production performance. Their labels are author judgments and should receive blind semantic review before evaluation.
