const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true },
  kind: { type: String, enum: ['achievement', 'project', 'responsibility', 'skill'], required: true },
  title: { type: String, required: true }, statement: { type: String, required: true },
  technologies: { type: [String], default: [] },
  context: { section: String, entryId: String, recordId: String },
  source: { kind: String, resumeId: mongoose.Schema.Types.ObjectId, profileId: mongoose.Schema.Types.ObjectId, sourceId: mongoose.Schema.Types.ObjectId, revision: Number, path: [mongoose.Schema.Types.Mixed], quote: String, url: String, label: String },
  verification: { type: String, enum: ['unverified', 'confirmed', 'rejected'], default: 'unverified' },
  confirmedAt: Date, measurement: { type: String, enum: ['unknown', 'reported', 'measured'], default: 'unknown' }, measurementNotes: { type: String, default: '' },
  revision: { type: Number, default: 1 }, archivedAt: Date,
}, { timestamps: true });
schema.index({ owner: 1, key: 1 }, { unique: true });
schema.index({ owner: 1, verification: 1, 'context.entryId': 1 });
module.exports = mongoose.model('CareerEvidence', schema);
