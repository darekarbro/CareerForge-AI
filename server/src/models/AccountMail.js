const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  emailHash: { type: String, required: true }, kind: { type: String, enum: ['verify', 'reset'], required: true },
  payload: { ciphertext: Buffer, iv: Buffer, tag: Buffer },
  status: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
  requestedAt: Date, nextRequestAt: Date, nextAttemptAt: Date, leaseExpiresAt: Date,
  attempts: { type: Number, default: 0 }, expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ emailHash: 1, kind: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AccountMail', schema);
