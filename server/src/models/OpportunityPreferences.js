const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  roles: [String], locations: [String], workModes: [String], avoidCompanies: [String],
  revision: { type: Number, default: 1 },
}, { timestamps: true });
module.exports = mongoose.model('OpportunityPreferences', schema);
