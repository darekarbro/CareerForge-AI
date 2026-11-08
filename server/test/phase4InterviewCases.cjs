module.exports = ({ test, assert, request, user, ready, successfulJob }) => {
  test('Phase 4: same-session adaptation is bounded, sequential, retry-safe and private', async () => {
    const a = await user(), b = await user(), resume = await ready(a.id);
    const output = await successfulJob(await request('POST', '/api/interview/sessions', { token: a.token, body: {
      resumeId: String(resume._id), targetRole: 'Backend Engineer', count: 3, feedbackMode: 'end',
    } }));
    assert.equal(output.session.adaptiveEnabled, true);
    const url = '/api/interview/sessions/' + output.session._id;
    const submit = (question, body, token = a.token) => request('POST', url + '/questions/' + question._id + '/answer', { token, body });
    assert.equal((await submit(output.questions[1], { userAnswer: 'Out of order' })).status, 409);
    assert.equal((await submit(output.questions[0], { userAnswer: 'No idea' }, b.token)).status, 404);
    const first = await successfulJob(await submit(output.questions[0], { userAnswer: 'No idea' }));
    assert.equal(first.followUpQuestion._id.toString(), output.questions[1]._id.toString());
    assert.equal(first.followUpQuestion.difficulty, 'Easy'); assert.equal(first.followUpQuestion.adaptation, undefined);
    assert.equal(first.followUpQuestion.suggestedAnswer, undefined); assert.equal(first.question.feedback, undefined);
    assert.deepEqual((await request('GET', '/api/interview/competencies', { token: a.token })).data.data.competencies, []);
    assert.deepEqual((await request('GET', '/api/interview/learning-plan', { token: a.token })).data.data.items, []);
    const Question = require('../src/models/InterviewQuestion');
    const next = await Question.findById(output.questions[1]._id);
    assert.equal(next.adaptation.kind, 'diagnostic'); assert.equal(next.topic, output.questions[0].topic);
    await successfulJob(await submit(output.questions[0], { userAnswer: 'I can explain a basic concept clearly with an example.', retry: true }));
    assert.equal((await Question.findById(next._id)).questionText, next.questionText);
    await successfulJob(await submit(output.questions[1], { userAnswer: 'I start with the basic definition and validate a concrete example.' }));
    const last = await successfulJob(await submit(output.questions[2], { userAnswer: 'I state the goal, show an example, and check it with a test.' }));
    assert.equal(last.session.status, 'completed'); assert.equal(last.session.totalQuestions, 3); assert.equal(last.session.answeredCount, 3);
    assert.equal(await Question.countDocuments({ sessionId: output.session._id }), 3);
    const detail = (await request('GET', url, { token: a.token })).data.data;
    assert.equal(detail.questions[1].adaptation.kind, 'diagnostic');
    const profile = (await request('GET', '/api/interview/competencies', { token: a.token })).data.data;
    assert.equal(profile.competencies.length, 1);
    const [competency] = profile.competencies;
    assert.equal(competency.sampleCount, 3);
    assert.equal(competency.attemptCount, 4);
    assert.equal(competency.assessmentBasis, 'unassessed');
    assert.equal(competency.assessedSampleCount, 0);
    assert.equal(competency.evidence.length, 4);
    for (const item of competency.evidence) {
      assert.equal(item.technicalAssessment, 'unassessed');
      assert.equal(item.sessionId, String(output.session._id));
      assert.equal(item.href, `/interview/session/${item.sessionId}?question=${item.questionId}&attempt=${item.attemptIndex}`);
    }
    assert.deepEqual((await request('GET', '/api/interview/competencies', { token: b.token })).data.data.competencies, []);
    assert.equal((await request('GET', '/api/interview/competencies')).status, 401);
    const plan = (await request('GET', '/api/interview/learning-plan', { token: a.token })).data.data;
    assert.deepEqual(plan.items, []);
    assert.deepEqual((await request('GET', '/api/interview/learning-plan', { token: b.token })).data.data.items, []);
    // A recovered commit cannot adapt the next question again.
    const source = await Question.findById(output.questions[0]._id);
    assert.equal(await require('../src/services/adaptiveInterview').resolveNext(detail.session, source), null);
  });
  test('Phase 4: learning plans include owned job skill gaps without inventing competency evidence', async () => {
    const a = await user(), b = await user(), resume = await ready(a.id);
    await require('../src/models/GapAnalysis').create({ owner: a.id, resumeId: resume._id, sourceRevision: 1, matchScore: 0,
      requirementMatches: [{ id: 'req-python', label: 'Python', category: 'required_skill', sourceText: 'Python required', status: 'missing', missingEvidence: 'Provide a truthful Python example.' }] });
    const plan = (await request('GET', '/api/interview/learning-plan', { token: a.token })).data.data;
    assert.equal(plan.items[0].topic, 'Python'); assert.equal(plan.items[0].confidence, 'unassessed');
    assert.deepEqual(plan.items[0].sourceEvidence, []); assert.equal(plan.items[0].requirementSources[0].requirementId, 'req-python');
    assert.deepEqual((await request('GET', '/api/interview/learning-plan', { token: b.token })).data.data.items, []);
    assert.equal((await request('GET', '/api/interview/learning-plan')).status, 401);
    await require('../src/models/Resume').updateOne({ _id: resume._id }, { $set: { contentRevision: 2 } });
    const changed = (await request('GET', '/api/interview/learning-plan', { token: a.token })).data.data;
    assert.deepEqual(changed.items, []); assert.equal(changed.excludedReports.stale, 1);
  });
};
