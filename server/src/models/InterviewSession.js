const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema(
  {
    processingJobId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
    pendingQuestions: { type: [mongoose.Schema.Types.Mixed], select: false, default: undefined },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobWorkspace', index: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    timeLimitSeconds: { type: Number, default: 0 },
    topicFocus: { type: String, default: '' },
    feedbackMode: { type: String, enum: ['instant', 'end'], default: 'instant' },
    answerScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetRole: {
      type: String,
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'cancelled'],
      default: 'in_progress',
    },
    overallScore: {
      type: Number,
      default: 0,
    },
    dimensionAverages: {
      clarity: { type: Number, default: 0 },
      relevance: { type: Number, default: 0 },
      structure: { type: Number, default: 0 },
      technical: { type: Number, default: 0 },
    },
    weakTopics: [String],
    strongTopics: [String],
    totalQuestions: {
      type: Number,
      default: 5,
    },
    answeredCount: {
      type: Number,
      default: 0,
    },
    scoreTotals: {
      overall: { type: Number, default: 0 }, clarity: { type: Number, default: 0 },
      relevance: { type: Number, default: 0 }, structure: { type: Number, default: 0 },
      technical: { type: Number, default: 0 },
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    aiProvider: {
      type: String,
      default: 'deterministic-fallback',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
