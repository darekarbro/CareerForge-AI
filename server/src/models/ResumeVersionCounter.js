const mongoose = require('mongoose');
module.exports = mongoose.model('ResumeVersionCounter', new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
  sequence: { type: Number, default: 0 },
}));
