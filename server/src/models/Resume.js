const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Primary Resume',
      trim: true,
    },
    originalFileName: {
      type: String,
    },
    originalFileUrl: {
      type: String,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'txt'],
      default: 'pdf',
    },
    rawText: {
      type: String,
    },
    parsedData: {
      contactInfo: {
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        location: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        github: { type: String, default: '' },
        portfolio: { type: String, default: '' },
      },
      summary: { type: String, default: '' },
      skills: {
        technical: [{ type: String }],
        soft: [{ type: String }],
        tools: [{ type: String }],
        frameworks: [{ type: String }],
        all: [{ type: String }],
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
      education: [
        {
          degree: String,
          institution: String,
          fieldOfStudy: String,
          graduationYear: String,
          score: String,
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
      certifications: [
        {
          name: String,
          issuer: String,
          year: String,
        },
      ],
    },
    atsScore: {
      score: { type: Number, default: 0 },
      formattingScore: { type: Number, default: 0 },
      structureScore: { type: Number, default: 0 },
      keywordScore: { type: Number, default: 0 },
      lengthScore: { type: Number, default: 0 },
      breakdown: [
        {
          category: String,
          status: { type: String, enum: ['pass', 'warning', 'fail'] },
          message: String,
        },
      ],
      strengths: [String],
      improvements: [String],
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Resume', resumeSchema);
