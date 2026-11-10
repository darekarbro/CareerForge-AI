const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String, cooldownUntil: Date,
  slots: [{ _id: false, token: String, expiresAt: Date }],
}, { timestamps: true });
module.exports = mongoose.model('ProviderGate', schema);
