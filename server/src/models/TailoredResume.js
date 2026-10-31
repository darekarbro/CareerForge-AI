const mongoose = require('mongoose');

const tailoredResumeSchema = new mongoose.Schema(
  {
    processingJobId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobWorkspace', index: true },
    workspaceRevision: Number,
    assessmentMeta: mongoose.Schema.Types.Mixed,
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
      contactInfo: mongoose.Schema.Types.Mixed,
      education: [mongoose.Schema.Types.Mixed],
      certifications: [mongoose.Schema.Types.Mixed],
      summary: String,
      skills: {
        technical: [String],
        soft: [String],
        tools: [String],
        frameworks: [String],
        all: [String],
      },
      workExperience: [
        {
          entryId: String,
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
          entryId: String,
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
      lengthScore: { type: Number, default: 0 },
      strengths: [String],
      improvements: [String],
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
    improvementSuggestions: [String],
    sourceContent: mongoose.Schema.Types.Mixed,
    sourceRevision: { type: Number, default: 1 },
    contentRevision: { type: Number, default: 1 },
    revisionName: { type: String, default: 'Generated draft' },
    presentation: mongoose.Schema.Types.Mixed,
    exportSettings: mongoose.Schema.Types.Mixed,
    layoutRevision: { type: Number, default: 1 },
    reviewedContent: mongoose.Schema.Types.Mixed,
    reviewDecisions: { type: mongoose.Schema.Types.Mixed, default: {} },
    reviewedAt: Date,
    atsScoreStale: { type: Boolean, default: false },
    editHistory: [{ revision: Number, name: String, content: mongoose.Schema.Types.Mixed, decisions: mongoose.Schema.Types.Mixed, presentation: mongoose.Schema.Types.Mixed, savedAt: Date }],
    aiProvider: {
      type: String,
      enum: ['groq', 'openrouter', 'gemini', 'deterministic-fallback'],
      default: 'deterministic-fallback',
    },
  },
  {
    timestamps: true,
  }
);

tailoredResumeSchema.index({ resumeId: 1, version: 1 }, { unique: true });
tailoredResumeSchema.virtual('reviewChanges').get(function () { return require('../services/resumeReview').changes(this); });
tailoredResumeSchema.virtual('reviewProgress').get(function () { return require('../services/resumeReview').progress(this); });
tailoredResumeSchema.set('toJSON', { transform(doc, result) {
  result.reviewChanges = require('../services/resumeReview').changes(doc);
  result.reviewProgress = require('../services/resumeReview').progress(doc);
  return result;
} });
module.exports = mongoose.model('TailoredResume', tailoredResumeSchema);
