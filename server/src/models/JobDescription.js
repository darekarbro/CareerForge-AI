const mongoose = require('mongoose');

const jobDescriptionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Target Job Description',
    },
    targetRole: {
      type: String,
      required: true,
    },
    company: {
      type: String,
    },
    rawText: {
      type: String,
      required: true,
    },
    parsedRequirements: {
      mustHaveSkills: [String],
      niceToHaveSkills: [String],
      experienceLevel: String,
      responsibilities: [String],
      keywords: [String],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('JobDescription', jobDescriptionSchema);
