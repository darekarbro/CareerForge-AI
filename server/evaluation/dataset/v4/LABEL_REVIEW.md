# Independent label review for the Phase 4 v4 holdout

The reviewer used `holdout.json`, `AUTHORING.md`, and the supplied annotation rules. The review took place before model execution. The reviewer did not access the application implementation, earlier fixtures, reports, or predictions.

The reviewer checked every candidate name and email against its source and verified that empty strings indicate absent candidate fields. The review traced each extracted skill to explicit candidate evidence and each requirement to the job description's stated category. Third-party work, copied terms, future plans, and denials without a positive claim were marked missing where required by the job description. Unreconciled personal claims and denials were marked uncertain and excluded from expected extraction.

One resume was clarified before freeze. In `v4-graduate-marsh-survey`, the text now identifies a one-time cleanup and a separate classifier task, and describes the local records without introducing an additional database product. This removes ambiguity about whether the tasks formed a pipeline and keeps the SQL evidence explicit. No expected label or status changed.

The approved split contains 30 cases, six per group. It has 120 expected skill extractions, 28 candidate names, and 28 candidate emails. Of 164 job requirements, 115 are supported, 47 are missing, and two are uncertain. Each category has one uncertain requirement. The data checks confirmed unique case IDs, unique skill labels within each case's extraction and requirements, exact-source matches for populated contact fields, and consistency between supported requirements and expected skill extraction.

The holdout is ready to freeze before model execution.
