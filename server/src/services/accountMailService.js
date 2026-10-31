const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const Mail = require('../models/AccountMail');
const User = require('../models/User');
const env = require('../config/env');
const { seal, open, digest, emailHash } = require('./privatePayload');
let timer, running;
const testMessages = [];
const context = (record) => 'account-mail:' + record.emailHash + ':' + record.kind;
const genericMessage = 'If this account is eligible, an email will arrive shortly. Check your inbox and spam folder.';
async function request(email, kind) {
  email = String(email).trim().toLowerCase();
  const hash = emailHash(email), now = new Date(), record = { emailHash: hash, kind };
  try {
    await Mail.findOneAndUpdate({ emailHash: hash, kind, nextRequestAt: { $lte: now }, status: { $ne: 'sending' } }, { $set: {
      payload: seal({ email }, context(record)), status: 'pending', attempts: 0, requestedAt: now, nextAttemptAt: now, nextRequestAt: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 3600000),
    }, $unset: { owner: 1, leaseExpiresAt: 1 } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  if (env.NODE_ENV === 'test') await drain();
  else if (env.QUEUE_MODE === 'combined') setImmediate(() => drain().catch(() => {}));
  return { message: genericMessage };
}
async function deliver(record) {
  const stored = open(record.payload, context(record));
  const user = await User.findOne({ email: stored.email, authProvider: 'local', deleting: { $ne: true } }).select('+passwordChangedAt');
  if (!user || record.kind === 'verify' && user.emailVerifiedAt || record.kind === 'reset' && user.passwordChangedAt && user.passwordChangedAt >= (record.requestedAt || record.createdAt)) {
    await Mail.updateOne({ _id: record._id }, { $set: { status: 'sent' }, $unset: { payload: 1, leaseExpiresAt: 1 } }); return;
  }
  const token = stored.token || crypto.randomBytes(32).toString('hex'), hash = digest(token);
  if (!stored.token) {
    const expiresAt = new Date(Date.now() + (record.kind === 'reset' ? 30 * 60000 : 24 * 3600000));
    await User.updateOne({ _id: user._id, deleting: { $ne: true } }, { $set: record.kind === 'reset' ? { resetHash: hash, resetExpiresAt: expiresAt, resetVersion: user.authVersion || 0 } : { verificationHash: hash, verificationExpiresAt: expiresAt } });
    await Mail.updateOne({ _id: record._id }, { $set: { owner: user._id, payload: seal({ email: stored.email, token }, context(record)) } });
  }
  const current = await User.findOne({ _id: user._id, deleting: { $ne: true }, [record.kind === 'reset' ? 'resetHash' : 'verificationHash']: hash, [record.kind === 'reset' ? 'resetExpiresAt' : 'verificationExpiresAt']: { $gt: new Date() } });
  if (!current) { await Mail.updateOne({ _id: record._id }, { $set: { status: 'sent' }, $unset: { payload: 1, leaseExpiresAt: 1 } }); return; }
  const link = env.APP_URL + (record.kind === 'reset' ? '/reset-password' : '/verify-email') + '#token=' + token;
  const subject = record.kind === 'reset' ? 'Reset your CareerForge password' : 'Verify your CareerForge email';
  const text = subject + '\n\n' + link + '\n\n' + (record.kind === 'reset' ? 'This link expires in 30 minutes.' : 'This link expires in 24 hours.') + '\nIf you did not request this, you can ignore this email.';
  if (env.NODE_ENV === 'test' && !env.SMTP_HOST) testMessages.push({ to: stored.email, subject, text });
  else {
    if (!env.SMTP_HOST) throw new Error('Email delivery is not configured');
    const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
      requireTLS: env.SMTP_REQUIRE_TLS, ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 });
    await transport.sendMail({ from: env.MAIL_FROM, to: stored.email, subject, text });
  }
  await Mail.updateOne({ _id: record._id }, { $set: { status: 'sent' }, $unset: { payload: 1, leaseExpiresAt: 1 } });
}
async function processPending() {
  for (let index = 0; index < 20; index++) {
    const now = new Date(), record = await Mail.findOneAndUpdate({ expiresAt: { $gt: now }, nextAttemptAt: { $lte: now }, $or: [{ status: 'pending' }, { status: 'sending', leaseExpiresAt: { $lt: now } }] },
      { $set: { status: 'sending', leaseExpiresAt: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } }, { new: true });
    if (!record) break;
    try { await deliver(record); }
    catch {
      await Mail.updateOne({ _id: record._id }, { $set: { status: record.attempts >= 5 ? 'failed' : 'pending', nextAttemptAt: new Date(Date.now() + Math.min(300000, 10000 * 2 ** record.attempts)) }, $unset: { leaseExpiresAt: 1 } });
    }
  }
}
function drain() { if (running) return running; running = processPending().finally(() => { running = null; }); return running; }
function start() { timer = setInterval(() => drain().catch(() => {}), 3000); timer.unref?.(); drain().catch(() => {}); }
async function stop() { clearInterval(timer); await running; }
module.exports = { request, drain, start, stop, testMessages, genericMessage };
