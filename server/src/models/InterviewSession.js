const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema(
  {
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
