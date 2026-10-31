const mongoose = require('mongoose');
const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, required: true }, fingerprint: { type: String, required: true }, result: mongoose.Schema.Types.Mixed,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 86400000) } }, { timestamps: true });
schema.index({ owner: 1, fingerprint: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AssessmentCache', schema);
