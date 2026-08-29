const mongoose = require('mongoose');

const interviewQuestionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      index: true,
    },
    order: {
      type: Number,
      default: 1,
    },
    questionText: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['technical', 'behavioral', 'role_specific', 'system_design'],
      default: 'technical',
    },
    topic: {
      type: String,
      default: 'General',
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    suggestedAnswer: {
      type: String,
      required: true,
    },
    keyPoints: [String],
    userAnswer: {
      type: String,
      default: '',
    },
    feedback: {
      clarityScore: { type: Number, min: 0, max: 100 },
      relevanceScore: { type: Number, min: 0, max: 100 },
      structureScore: { type: Number, min: 0, max: 100 },
      technicalScore: { type: Number, min: 0, max: 100 },
      overallScore: { type: Number, min: 0, max: 100 },
      strengths: [String],
      improvements: [String],
      starAdherence: String,
      comments: String,
      evaluatedAt: Date,
      aiProvider: String,
    },
    answeredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InterviewQuestion', interviewQuestionSchema);
