const mongoose = require('mongoose');

const jobSearchQuerySchema = new mongoose.Schema(
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
    location: {
      type: String,
      default: 'Remote',
    },
    experienceLevel: {
      type: String,
      default: 'Mid-Senior',
    },
    generatedKeywords: [
      {
        type: String,
      },
    ],
    generatedLinks: {
      linkedin: { type: String, required: true },
      internshala: { type: String, required: true },
      naukri: { type: String, required: true },
      indeed: { type: String, required: true },
    },
    resumeSkillsUsed: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('JobSearchQuery', jobSearchQuerySchema);
