const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ciphertext: { type: Buffer, required: true }, iv: { type: Buffer, required: true }, tag: { type: Buffer, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('JobPayload', schema);
