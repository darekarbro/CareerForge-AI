const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    deadline: Date,
    followUpAt: Date,
    interviewAt: Date,
    notificationPreferences: {
      inApp: { type: Boolean, default: true },
      calendarAlarm: { type: Boolean, default: false },
      leadMinutes: { type: Number, default: 60 },
    },
    recruiter: { name: String, email: String, phone: String, notes: String },
    attachments: [{ name: String, mime: String, bytes: Number, uploadedAt: { type: Date, default: Date.now }, data: { type: Buffer, select: false } }],
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobWorkspace' },
    resumeVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TailoredResume' },
    resumeSnapshot: mongoose.Schema.Types.Mixed,
    revision: { type: Number, default: 1 },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    roleTitle: {
      type: String,
      required: [true, 'Role title is required'],
      trim: true,
    },
    sourcePlatform: {
      type: String,
      enum: ['LinkedIn', 'Internshala', 'Naukri', 'Indeed', 'Company Portal', 'Referral', 'Other'],
      default: 'LinkedIn',
    },
    jobLink: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['saved', 'applied', 'oa', 'interview', 'offer', 'rejected'],
      default: 'saved',
      index: true,
    },
    appliedDate: {
      type: Date,
      default: null,
    },
    salaryRange: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    timeline: [
      {
        status: String,
        updatedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

module.exports = mongoose.model('Application', applicationSchema);
