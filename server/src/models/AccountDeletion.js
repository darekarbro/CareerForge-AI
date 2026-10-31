const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiptHash: { type: String, required: true, unique: true },
  emailHash: String,
  status: { type: String, enum: ['pending', 'running', 'retrying', 'completed'], default: 'pending' },
  files: [mongoose.Schema.Types.Mixed], attempts: { type: Number, default: 0 },
  leaseOwner: String, leaseExpiresAt: Date, nextAttemptAt: { type: Date, default: Date.now },
  completedAt: Date, expiresAt: Date,
}, { timestamps: true });
schema.index({ owner: 1 }, { unique: true, partialFilterExpression: { owner: { $type: 'objectId' } } });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AccountDeletion', schema);
