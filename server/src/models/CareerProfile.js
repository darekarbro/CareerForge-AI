const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  targetRole: { type: String, default: 'Fullstack Developer' },
  experienceLevel: { type: String, enum: ['student', 'early', 'mid', 'senior'], default: 'early' },
  revision: { type: Number, default: 1 },
  onboardingCompleted: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('CareerProfile', schema);
