const mongoose = require('mongoose');
const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, expiresAt: { type: Date, required: true } });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AccountOperation', schema);
