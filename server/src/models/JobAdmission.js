const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  slots: [{ _id: false, jobId: mongoose.Schema.Types.ObjectId, reservedAt: Date }],
}, { timestamps: true });
module.exports = mongoose.model('JobAdmission', schema);
