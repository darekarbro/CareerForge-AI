const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, updatedAt: Date, expiresAt: Date });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('WorkerHeartbeat', schema);
