const mongoose = require('mongoose');
const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ['pdf_export', 'docx_export'], required: true }, resumeId: mongoose.Schema.Types.ObjectId,
  versionId: mongoose.Schema.Types.ObjectId }, { timestamps: true });
module.exports = mongoose.model('ProductEvent', schema);
