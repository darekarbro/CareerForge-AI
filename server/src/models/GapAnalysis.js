const mongoose = require('mongoose');

const gapAnalysisSchema = new mongoose.Schema(
  {
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
      index: true,
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    matchScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    mustHaveMissing: [
      {
        skill: String,
        importance: { type: String, default: 'high' },
        recommendation: String,
      },
    ],
    niceToHaveMissing: [
      {
        skill: String,
        importance: { type: String, default: 'medium' },
        recommendation: String,
      },
    ],
    matchedSkills: [
      {
        skill: String,
        category: String,
        supportingResumeLines: [String],
      },
    ],
    summaryRecommendations: [String],
    aiProvider: {
      type: String,
      default: 'deterministic-fallback',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GapAnalysis', gapAnalysisSchema);
