const Session = require('../models/InterviewSession');
const Question = require('../models/InterviewQuestion');

const rubricVersion = 'competency-evidence-v2';
const limitations = [
  'Practice scores are estimates, not verified skill certifications or hiring predictions.',
  'Offline technical checks cover a small set of questions. Unassessed answers retain practice evidence without establishing a strength or gap.',
  'Topic names come from practice questions. Missing topics mean unassessed, not weak.',
  'Averages use only the latest attempt for each question. Retries remain linked as evidence without inflating the sample count.',
  'End-feedback sessions contribute only after completion. Cancelled sessions are excluded.',
];

function buildProfile(questions) {
  const groups = new Map();
  for (const question of questions) {
    if (!question.answeredAt || !Number.isFinite(question.feedback?.overallScore)) continue;
    const topic = (question.topic || 'General').trim() || 'General', key = topic.toLowerCase();
    const group = groups.get(key) || { topic, scores: [], technicalScores: [], judgments: [], evidence: [], sessions: new Set() };
    group.scores.push(question.feedback.overallScore);
    if (Number.isFinite(question.feedback.technicalScore)) group.technicalScores.push(question.feedback.technicalScore);
    group.sessions.add(String(question.sessionId));
    if (question.feedback.technicalAssessment !== 'unassessed') {
      group.judgments.push({ sessionId: String(question.sessionId), score: question.feedback.overallScore,
        technical: question.feedback.technicalAssessment === 'rubric-checked' && Number.isFinite(question.feedback.technicalScore)
          ? question.feedback.technicalScore : null });
    }
    const attempts = [...(question.attempts || []), { userAnswer: question.userAnswer, feedback: question.feedback, answeredAt: question.answeredAt }];
    attempts.forEach((attempt, attemptIndex) => {
      if (!Number.isFinite(attempt.feedback?.overallScore)) return;
      group.evidence.push({ sessionId: String(question.sessionId), questionId: String(question._id), attemptIndex,
        current: attemptIndex === attempts.length - 1, questionText: question.questionText, answerExcerpt: (attempt.userAnswer || '').slice(0, 500),
        score: attempt.feedback.overallScore, technicalScore: attempt.feedback.technicalScore,
        technicalAssessment: attempt.feedback.technicalAssessment, provider: attempt.feedback.aiProvider || 'unknown', answeredAt: attempt.answeredAt,
        href: `/interview/session/${question.sessionId}?question=${question._id}&attempt=${attemptIndex}` });
    });
    groups.set(key, group);
  }
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  return { rubricVersion, limitations, competencies: [...groups.values()].map((group) => {
    const chronological = group.evidence.sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
    const firstScore = chronological[0].score, latestScore = chronological.at(-1).score, averageScore = average(group.scores);
    const assessedSampleCount = group.judgments.length;
    const allTechnical = assessedSampleCount > 0 && group.judgments.every(item => item.technical !== null);
    const assessmentBasis = allTechnical ? 'technical' : assessedSampleCount ? 'overall' : 'unassessed';
    const assessmentScore = average(group.judgments.map(item => allTechnical ? item.technical : item.score));
    const assessedSessionCount = new Set(group.judgments.map(item => item.sessionId)).size;
    const status = assessmentScore === null ? 'developing'
      : assessmentScore < (allTechnical ? 40 : 70) ? 'gap'
        : assessmentScore >= (allTechnical ? 75 : 80) && assessedSampleCount >= 2 ? 'strength' : 'developing';
    return { topic: group.topic, status, assessmentBasis, assessmentScore, assessedSampleCount,
      averageScore, averageTechnicalScore: average(group.technicalScores), sampleCount: group.scores.length, sessionCount: group.sessions.size,
      attemptCount: chronological.length, confidence: assessedSessionCount >= 3 && assessedSampleCount >= 3 ? 'moderate' : 'low',
      trend: { firstScore, latestScore, delta: latestScore - firstScore },
      evidence: chronological.slice(-50).reverse(), omittedEvidenceCount: Math.max(0, chronological.length - 50) };
  }).sort((a, b) => a.averageScore - b.averageScore || a.topic.localeCompare(b.topic)) };
}

async function getProfile(owner) {
  const sessions = await Session.find({ owner, status: { $ne: 'cancelled' },
    $or: [{ feedbackMode: { $ne: 'end' } }, { status: 'completed' }] }).select('_id');
  const questions = await Question.find({ sessionId: { $in: sessions.map((session) => session._id) }, answeredAt: { $exists: true },
    'feedback.overallScore': { $exists: true } }).sort({ answeredAt: 1 }).lean();
  return buildProfile(questions);
}

module.exports = { getProfile, buildProfile, rubricVersion, limitations };
