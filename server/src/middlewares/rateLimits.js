const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const options = {
  windowMs: 15 * 60 * 1000, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Request limit reached. Please try again later.' },
};
function createLimiters({ authMax = env.AUTH_RATE_LIMIT_MAX, aiMax = env.AI_RATE_LIMIT_MAX } = {}) {
  const authLimiter = rateLimit({ ...options, max: authMax });
  const aiIpLimiter = rateLimit({ ...options, max: aiMax * 3 });
  // Mounted after protect so accounts retain separate quotas behind a proxy.
  const aiLimiter = rateLimit({ ...options, max: aiMax, keyGenerator: (req) => String(req.user._id) });
  return { authLimiter, aiIpLimiter, aiLimiter };
}
module.exports = { ...createLimiters(), createLimiters };
