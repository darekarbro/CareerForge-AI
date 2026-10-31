const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['github', 'document'], required: true }, title: String, url: String,
  text: { type: String, required: true }, candidates: [mongoose.Schema.Types.Mixed], metadata: mongoose.Schema.Types.Mixed,
  confirmedAt: Date, revision: { type: Number, default: 1 },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 86400000), index: { expires: 0 } },
}, { timestamps: true });
module.exports = mongoose.model('EvidenceSource', schema);
