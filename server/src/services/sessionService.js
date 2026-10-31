const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/AuthSession');
const env = require('../config/env');
const fail = () => Object.assign(new Error('Your session expired or was revoked. Please sign in again.'), { statusCode: 401, code: 'SESSION_EXPIRED' });
function deviceName(agent = '') {
  if (/Edg\//.test(agent)) return 'Edge browser';
  if (/Firefox\//.test(agent)) return 'Firefox browser';
  if (/Chrome\//.test(agent)) return 'Chrome browser';
  if (/Safari\//.test(agent)) return 'Safari browser';
  return 'Browser session';
}
async function issue(user, agent) {
  if (user.deleting) throw fail();
  const id = new mongoose.Types.ObjectId(), authVersion = user.authVersion || 0;
  const token = jwt.sign({ id: user._id, ver: authVersion, sid: String(id) }, env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256', issuer: 'careerforge', audience: 'careerforge-app' });
  await Session.create({ _id: id, owner: user._id, authVersion, device: deviceName(agent), expiresAt: new Date(jwt.decode(token).exp * 1000) });
  const current = await User.findOne({ _id: user._id, deleting: { $ne: true } });
  if (!current || (current.authVersion || 0) !== authVersion) { await Session.deleteOne({ _id: id }); throw fail(); }
  return token;
}
async function authenticate(token) {
  let decoded;
  try { decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'careerforge', audience: 'careerforge-app' }); }
  catch { throw fail(); }
  if (!mongoose.isValidObjectId(decoded.id) || !mongoose.isValidObjectId(decoded.sid) || !Number.isInteger(decoded.ver)) throw fail();
  const [user, session] = await Promise.all([User.findOne({ _id: decoded.id, deleting: { $ne: true } }), Session.findOne({ _id: decoded.sid, owner: decoded.id, authVersion: decoded.ver, expiresAt: { $gt: new Date() } })]);
  if (!user || !session || (user.authVersion || 0) !== decoded.ver) throw fail();
  return { user, session, decoded };
}
async function revokeAll(owner) {
  await User.updateOne({ _id: owner }, { $inc: { authVersion: 1 } });
  await Session.deleteMany({ owner });
  require('../config/socket').disconnectUserSockets(owner);
}
async function revokeCurrent(owner, sessionId) {
  await Session.deleteOne({ _id: sessionId, owner });
  require('../config/socket').disconnectSessionSockets(sessionId);
}
module.exports = { issue, authenticate, revokeAll, revokeCurrent };
