const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  day: { type: String, required: true },
  reservedMicrousd: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ owner: 1, day: 1 }, { unique: true });
module.exports = mongoose.model('UsageBudget', schema);
