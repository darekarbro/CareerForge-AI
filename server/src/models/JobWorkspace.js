const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  company: { type: String, required: true }, title: { type: String, required: true },
  jobUrl: String, description: { type: String, required: true }, notes: String,
  revision: { type: Number, default: 1 },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
  jobDescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobDescription' },
  latestVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TailoredResume' },
  latestGapId: { type: mongoose.Schema.Types.ObjectId, ref: 'GapAnalysis' },
  interviewIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession' }],
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
}, { timestamps: true });
schema.index({ owner: 1, updatedAt: -1 });
module.exports = mongoose.model('JobWorkspace', schema);
