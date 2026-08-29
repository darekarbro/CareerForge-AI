const mongoose = require('mongoose');

const tailoredResumeSchema = new mongoose.Schema(
  {
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetRole: {
      type: String,
      required: true,
      trim: true,
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
    },
    jobDescriptionText: {
      type: String,
    },
    tailoredContent: {
      summary: String,
      skills: {
        technical: [String],
        tools: [String],
        frameworks: [String],
        all: [String],
      },
      workExperience: [
        {
          role: String,
          company: String,
          location: String,
          startDate: String,
          endDate: String,
          current: Boolean,
          highlights: [String],
        },
      ],
      projects: [
        {
          title: String,
          description: String,
          technologies: [String],
          link: String,
          highlights: [String],
        },
      ],
    },
    atsScore: {
      score: { type: Number, default: 0 },
      keywordScore: { type: Number, default: 0 },
      structureScore: { type: Number, default: 0 },
      formattingScore: { type: Number, default: 0 },
      breakdown: [
        {
          category: String,
          status: String,
          message: String,
        },
      ],
    },
    diffFromOriginal: {
      addedSkills: [String],
      removedSkills: [String],
      modifiedHighlights: [
        {
          section: String,
          original: String,
          tailored: String,
          reason: String,
        },
      ],
      summaryDiff: {
        original: String,
        tailored: String,
      },
    },
    version: {
      type: Number,
      default: 1,
    },
    pdfDownloadUrl: {
      type: String,
    },
    aiProvider: {
      type: String,
      enum: ['openrouter', 'gemini', 'deterministic-fallback'],
      default: 'deterministic-fallback',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TailoredResume', tailoredResumeSchema);
