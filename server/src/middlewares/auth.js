const protect = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!token) return res.status(401).json({ success: false, code: 'SESSION_REQUIRED', message: 'Please sign in to continue.' });
  try {
    const { user, session, decoded } = await require('../services/sessionService').authenticate(token);
    // A deletion worker waits for requests already in flight, including uploads and exports.
    const Operation = require('../models/AccountOperation');
    const operation = await Operation.create({ owner: user._id, expiresAt: new Date(Date.now() + 90000) });
    if (!await require('../models/User').exists({ _id: user._id, deleting: { $ne: true } })) {
      await operation.deleteOne(); return res.status(401).json({ success: false, code: 'SESSION_EXPIRED', message: 'Please sign in again.' });
    }
    const heartbeat = setInterval(() => Operation.updateOne({ _id: operation._id }, { $set: { expiresAt: new Date(Date.now() + 90000) } }).catch(() => {}), 10000);
    heartbeat.unref?.();
    let released = false;
    const release = () => { if (released) return; released = true; clearInterval(heartbeat); Operation.deleteOne({ _id: operation._id }).catch(() => {}); };
    res.once('finish', release);
    // An interrupted client connection does not cancel its handler. Release only when it ends.
    const end = res.end;
    res.end = function (...args) { try { return end.apply(this, args); } finally { release(); } };
    req.user = user; req.auth = { sessionId: session._id, expiresAt: decoded.exp * 1000 }; next();
  } catch (error) {
    if (error.statusCode === 401) return res.status(401).json({ success: false, code: error.code, message: error.message });
    error.statusCode = 503; error.message = 'Sign-in verification is temporarily unavailable. Please retry.'; next(error);
  }
};
const restrictTo = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
module.exports = { protect, restrictTo };
