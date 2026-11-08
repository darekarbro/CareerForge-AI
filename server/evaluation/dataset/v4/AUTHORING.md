# Phase 4 synthetic holdout v4

The independent author wrote 30 fictional English resume and job-description pairs from the supplied annotation rubric and public skill vocabulary. Authoring took place before model execution. The author had no access to the application implementation, prior fixtures, reports, or model predictions. All people and work histories are fictional, and all emails use reserved example domains.

The split contains six cases each for graduate, experienced, sparse, formatting, and misleading inputs. The cases include conventional work histories, short excerpts, form exports, tables, and a transcript. Each job description explicitly separates required and preferred skills. The gold includes 164 skill requirements across both categories, with 115 supported, 47 missing, and two uncertain.

Candidate name and email preserve the spelling and casing in the candidate's own source, with an empty string for an absent field. Skill annotations use canonical vocabulary labels for explicit candidate experience. A third-party skill, denial alone, or future plan is missing. Conflicting first-person claims with no reconciliation make the requirement uncertain and exclude the skill from expected extraction. Case notes record the evidence and attribution decisions.
