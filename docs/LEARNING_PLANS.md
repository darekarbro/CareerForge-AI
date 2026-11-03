# Actionable learning plans

`GET /api/interview/learning-plan` turns the signed-in user's interview practice gaps and developing topics into two practice tasks, two small project milestones and a three-question reassessment. Each task has instructions and an observable completion condition. Each interview gap links back to the answer attempts behind it.

Missing or uncertain required/preferred skills from the latest saved job-match report per resume and job pair also contribute. These topics are labelled **unassessed** with the source requirement, report ID, resume ID and missing evidence, rather than an invented competency score. A missing resume citation may mean the user already has relevant work but has not documented it; the first task asks them to check this before choosing training. Non-skill constraints such as eligibility and availability require direct clarification and do not become skill practice tasks.

The plan returns up to eight topics. Interview gaps come first, followed by job-match skill gaps; strengths do not create interview practice tasks. Each reassessment uses Easy difficulty for a gap/unassessed topic and Medium for a developing topic. It asks for a concrete example, alternatives, failure handling and a check. A human reviewer should confirm technical correctness; an increased automated score alone is insufficient.

Plans are derived from saved records and refresh when new answers or reports are saved. Task completion is not automatically verified or persisted as a claim. Keep the resulting artifact in your own workspace and use reassessment to check what you can now explain. Course recommendations, predicted hiring success and technically verified mastery are outside this feature's scope.
