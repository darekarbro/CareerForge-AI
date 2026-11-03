# Evidence-backed competency profile

`GET /api/interview/competencies` derives the signed-in user's profile from their saved questions and answer attempts. It does not make an independent copy of personal answers. Resume or account deletion removes those source records and therefore removes the derived profile, and account export already includes every source session, question and attempt.

Each topic includes the latest-attempt average, technical average, independent question count, session count, total attempts, first-to-latest score trend and links to the answer attempts behind it. The latest 50 evidence links per topic are returned, with `omittedEvidenceCount` showing any older links withheld from the response. Historical attempts do not inflate the independent sample count or average. Topic labels are compared case-insensitively; other synonyms are not merged.

Statuses describe observed practice results: **gap** below 70, **strength** at least 80 across two or more questions, and **developing** otherwise. Confidence is **moderate** only with at least three independent questions in three sessions, and **low** otherwise. These are declared evidence sufficiency rules, not statistically calibrated probabilities. Missing topics are unassessed, not weak.

End-feedback sessions contribute after completion; cancelled sessions never contribute. Provider feedback, especially offline keyword/structure scoring, can be misleading. Score trends reflect the selected practice attempts and question difficulty as well as possible improvement; they are not causal proof of learning or employment readiness.
