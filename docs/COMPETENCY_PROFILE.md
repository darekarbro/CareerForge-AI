# Evidence-backed competency profile

`GET /api/interview/competencies` derives the signed-in user's profile from their saved questions and answer attempts. It does not make an independent copy of personal answers. Resume or account deletion removes those source records and therefore removes the derived profile, and account export already includes every source session, question and attempt.

Each topic includes the latest-attempt average, technical average, independent question count, session count, total attempts, first-to-latest score trend and links to the answer attempts behind it. The latest 50 evidence links per topic are returned, with `omittedEvidenceCount` showing any older links withheld from the response. Historical attempts do not inflate the independent sample count or average. Topic labels are compared case-insensitively; other synonyms are not merged.

Statuses use the latest assessed answer for each question. For a topic assessed entirely with the offline technical rubric, **gap** means a technical average below 40 and **strength** requires at least 75 across two or more questions. Other assessed topics use the overall practice average with thresholds of 70 and 80. The remaining assessed topics are **developing**. Confidence is **moderate** only with at least three assessed questions in three sessions. Technically unassessed answers retain their history and links while staying outside strength and gap decisions and interview-based learning recommendations.

Completed end-feedback sessions contribute to the profile. Practice trends reflect the selected attempts, question difficulty and possible improvement. Provider feedback and bounded offline checks can both miss nuances in an answer.
