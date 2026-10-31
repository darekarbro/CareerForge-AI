const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true, index: true }, workspaceId: mongoose.Schema.Types.ObjectId, workspaceRevision: Number,
  jobId: mongoose.Schema.Types.ObjectId, versionId: mongoose.Schema.Types.ObjectId,
  targetRole: String, scope: { type: String, default: 'all' }, jobDescriptionText: String, sourceRevision: Number, revision: { type: Number, default: 1 },
  status: { type: String, enum: ['planning', 'needs_input', 'draft_ready', 'review_recommended'], default: 'planning' },
  questions: [mongoose.Schema.Types.Mixed], answers: [mongoose.Schema.Types.Mixed], clarified: { type: Boolean, default: false },
  trace: [mongoose.Schema.Types.Mixed], retrieval: [mongoose.Schema.Types.Mixed],
}, { timestamps: true });
module.exports = mongoose.model('CopilotRun', schema);
