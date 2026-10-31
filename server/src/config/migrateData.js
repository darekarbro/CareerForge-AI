const mongoose = require('mongoose');
async function migrateData() {
  const User = require('../models/User'), Resume = require('../models/Resume');
  const Tailored = require('../models/TailoredResume'), Session = require('../models/InterviewSession');
  const Question = require('../models/InterviewQuestion');
  // Raw collection writes intentionally bypass the new empty-UID setter for legacy records.
  await User.collection.updateMany({ firebaseUid: { $in: ['', null] } }, { $unset: { firebaseUid: 1 } });
  for await (const user of User.find({ password: { $not: /^\$2[aby]\$/ } }).select('+password').cursor()) {
    if (typeof user.password === 'string' && user.password.length >= 6) {
      user.markModified('password');
      await user.save();
    }
  }
  await Resume.collection.updateMany({ processingStatus: { $exists: false }, rawText: { $type: 'string', $ne: '' } },
    { $set: { processingStatus: 'COMPLETED' } });
  await require('../models/Application').collection.updateMany({ status: 'saved',
    'timeline.status': { $nin: ['applied', 'oa', 'interview', 'offer'] } }, { $set: { appliedDate: null } });
  // Resolve legacy duplicate versions without changing resume contents or version document IDs.
  const seen = new Map();
  for await (const version of Tailored.find().sort({ resumeId: 1, version: 1, createdAt: 1 }).select('resumeId version').cursor()) {
    const key = String(version.resumeId), next = Math.max(version.version || 1, (seen.get(key) || 0) + 1);
    if (next !== version.version) await Tailored.collection.updateOne({ _id: version._id }, { $set: { version: next } });
    seen.set(key, next);
  }
  for await (const session of Session.find({ scoreTotals: { $exists: false } }).cursor()) {
    const questions = await Question.find({ sessionId: session._id });
    const answered = questions.filter((question) => Number.isFinite(question.feedback?.overallScore));
    const totals = {};
    for (const key of ['overall', 'clarity', 'relevance', 'structure', 'technical']) {
      totals[key] = answered.reduce((sum, question) => sum + (question.feedback[key + 'Score'] || 0), 0);
    }
    if (!questions.length) {
      await Session.collection.updateOne({ _id: session._id }, { $set: { status: 'cancelled', scoreTotals: totals, totalQuestions: 0 } });
      continue;
    }
    await Session.collection.updateOne({ _id: session._id }, { $set: {
      scoreTotals: totals, totalQuestions: questions.length, answeredCount: answered.length,
      overallScore: answered.length ? Math.round(totals.overall / answered.length) : 0,
      ...(answered.length === questions.length ? { status: 'completed', completedAt: session.completedAt || new Date() } : {}),
    } });
  }
  for (const model of Object.values(mongoose.models)) await model.createIndexes();
}
module.exports = { migrateData };
