const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
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
      default: Date.now,
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
  }
);

module.exports = mongoose.model('Application', applicationSchema);
