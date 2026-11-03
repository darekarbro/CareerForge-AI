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
    // A recovered commit cannot adapt the next question again.
    const source = await Question.findById(output.questions[0]._id);
    assert.equal(await require('../src/services/adaptiveInterview').resolveNext(detail.session, source), null);
  });
};
