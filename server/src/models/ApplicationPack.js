const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobWorkspace', required: true },
  sourceFingerprint: { type: String, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  drafts: { type: mongoose.Schema.Types.Mixed, required: true },
  reviewed: { type: [String], default: [] },
  revision: { type: Number, default: 1 },
}, { timestamps: true });
schema.index({ owner: 1, workspaceId: 1 }, { unique: true });
module.exports = mongoose.model('ApplicationPack', schema);
