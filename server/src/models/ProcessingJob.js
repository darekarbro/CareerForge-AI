const mongoose = require('mongoose');

const processingJobSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: [
        'resume_parse',
        'resume_tailor',
        'section_rewrite',
        'gap_analysis',
        'ats_score',
        'question_generation',
        'answer_evaluation',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMMITTING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    inputRef: {
      resumeId: mongoose.Schema.Types.ObjectId,
      versionId: mongoose.Schema.Types.ObjectId,
      workspaceId: mongoose.Schema.Types.ObjectId,
      workspaceRevision: Number,
      jobDescriptionId: mongoose.Schema.Types.ObjectId,
      sessionId: mongoose.Schema.Types.ObjectId,
      questionId: mongoose.Schema.Types.ObjectId,
      answerBaseJobId: mongoose.Schema.Types.ObjectId,
      targetRole: String,
      rawInput: mongoose.Schema.Types.Mixed,
    },
    output: mongoose.Schema.Types.Mixed,
    error: {
      code: String,
      message: String,
      stack: String,
      agent: String,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    leaseOwner: String,
    leaseExpiresAt: Date,
    executionOwner: String,
    executionExpiresAt: Date,
    recoveredAt: Date,
    usage: [{ action: String, provider: String, model: String, durationMs: Number, status: String, inputTokens: Number, outputTokens: Number }],
    retryCount: {
      type: Number,
      default: 0,
    },
    currentAgent: {
      type: String,
      default: 'monitoring',
    },
    startedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ProcessingJob', processingJobSchema);
