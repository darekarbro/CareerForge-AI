const mongoose = require('mongoose');

const jobDescriptionSchema = new mongoose.Schema(
  {
    processingJobId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
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
      requiredSkills: [mongoose.Schema.Types.Mixed],
      preferredSkills: [mongoose.Schema.Types.Mixed],
      experience: [mongoose.Schema.Types.Mixed],
      constraints: [mongoose.Schema.Types.Mixed],
      unclassified: [mongoose.Schema.Types.Mixed],
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

jobDescriptionSchema.pre('validate', function () {
  if (this.isModified('rawText')) this.parsedRequirements = require('../services/jobRequirements').extractRequirements(this.rawText);
});
module.exports = mongoose.model('JobDescription', jobDescriptionSchema);
