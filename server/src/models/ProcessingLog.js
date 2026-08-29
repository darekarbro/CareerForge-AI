const mongoose = require('mongoose');

const processingLogSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProcessingJob',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    agent: {
      type: String,
      enum: ['parser', 'analyzer', 'generator', 'evaluator', 'recovery', 'monitoring', 'orchestrator'],
      required: true,
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info',
    },
    message: {
      type: String,
      required: true,
    },
    step: {
      type: String,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ProcessingLog', processingLogSchema);
