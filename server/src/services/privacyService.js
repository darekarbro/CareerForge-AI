const crypto = require('node:crypto');
const User = require('../models/User');
const Deletion = require('../models/AccountDeletion');
const { digest, emailHash } = require('./privatePayload');
const { fail } = require('./resumeContent');
const ownedCollections = ['CareerProfile', 'Resume', 'TailoredResume', 'JobWorkspace', 'JobDescription', 'GapAnalysis', 'InterviewSession',
  'Application', 'JobSearchQuery', 'ProcessingJob', 'ProcessingLog', 'Notification', 'AssessmentCache', 'ProductEvent', 'JobPayload', 'AuthSession'];
const model = (name) => require('../models/' + name);
function preferences(user) {
  const privacy = user.privacy || {};
  return { providers: Object.fromEntries(['groq', 'openrouter', 'gemini'].map((key) => [key, privacy.providers?.[key] === true])),
    activityDays: privacy.activityDays || 90, cacheDays: privacy.cacheDays || 7, retryInputHours: privacy.retryInputHours || 24 };
}
async function get(owner) {
  const user = await User.findOne({ _id: owner, deleting: { $ne: true } });
  if (!user) throw fail('Account unavailable', 401);
  return preferences(user);
}
async function save(owner, input) {
  if (!input || Object.keys(input).some((key) => !['providers', 'activityDays', 'cacheDays', 'retryInputHours'].includes(key))) throw fail('Unsupported privacy setting');
  const providers = input.providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers) || Object.keys(providers).some((key) => !['groq', 'openrouter', 'gemini'].includes(key)) || ['groq', 'openrouter', 'gemini'].some((key) => typeof providers[key] !== 'boolean')) throw fail('Choose sharing permission for each provider');
  if (![30, 90, 365].includes(input.activityDays) || ![1, 7, 30].includes(input.cacheDays) || ![1, 6, 24].includes(input.retryInputHours)) throw fail('Choose supported retention periods');
  const user = await User.findOneAndUpdate({ _id: owner, deleting: { $ne: true } }, { $set: { privacy: { ...input, updatedAt: new Date() } } }, { new: true, runValidators: true });
  if (!user) throw fail('Account unavailable', 401);
  await model('AssessmentCache').deleteMany({ owner });
  await applyRetention(user);
  return preferences(user);
}
async function reauthenticate(user, input) {
  if (user.authProvider === 'local') {
    const account = await User.findOne({ _id: user._id, deleting: { $ne: true } }).select('+password');
    if (!account || typeof input.password !== 'string' || !await account.comparePassword(input.password)) throw Object.assign(fail('Current password is incorrect', 401), { code: 'REAUTH_REQUIRED' });
  } else {
    let decoded;
    try { decoded = await require('./authService').verifyFirebaseToken(input.idToken); }
    catch (error) { if (error.statusCode === 401) error.code = 'REAUTH_REQUIRED'; throw error; }
    if (decoded.uid !== user.firebaseUid || decoded.email_verified !== true || decoded.firebase?.sign_in_provider !== 'google.com' || !decoded.auth_time || Date.now() / 1000 - decoded.auth_time > 300) throw Object.assign(fail('Sign in with Google again to confirm this action', 401), { code: 'REAUTH_REQUIRED' });
  }
}
async function exportData(user, input) {
  await reauthenticate(user, input);
  if (input.includeOriginals !== undefined && typeof input.includeOriginals !== 'boolean') throw fail('Choose whether to include original files');
  const owner = user._id, data = { formatVersion: 1, exportedAt: new Date().toISOString(), account: require('./authService').publicUser(user), privacy: preferences(user), records: {} };
  const keys = { Resume: '-originalFileStorage -originalFileUrl', ProcessingJob: '-inputRef.rawInput -leaseOwner -executionOwner -error.stack', JobPayload: '_id jobId createdAt expiresAt', AuthSession: 'device createdAt expiresAt' };
  for (const name of ownedCollections) data.records[name] = await model(name).find({ owner }).select(keys[name] || '').lean();
  const sessions = data.records.InterviewSession.map((item) => item._id);
  data.records.InterviewQuestion = await model('InterviewQuestion').find({ sessionId: { $in: sessions } }).lean();
  const zip = new (require('jszip'))(), manifest = { originalFilesIncluded: input.includeOriginals !== false, files: [] };
  let bytes = 0;
  if (input.includeOriginals !== false) {
    const resumes = await model('Resume').find({ owner });
    for (const [index, resume] of resumes.entries()) {
      if (!resume.originalFileStorage?.provider && !resume.originalFileName) continue;
      const buffer = await require('../config/cloudinary').readOriginal(resume);
      bytes += buffer.length;
      if (bytes > 50 * 1024 * 1024) throw fail('Original files exceed the 50 MB export limit. Export records without originals and download originals separately.', 413);
      const filename = 'originals/' + (index + 1) + '-' + (resume.originalFileName || 'resume.' + resume.fileType).replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 120);
      zip.file(filename, buffer); manifest.files.push({ resumeId: resume._id, filename, bytes: buffer.length });
    }
  }
  const json = JSON.stringify(data, null, 2);
  if (Buffer.byteLength(json) + bytes > 70 * 1024 * 1024) throw fail('This account export is too large for one download. Export records in smaller groups through the individual resume pages.', 413);
  zip.file('account-data.json', json); zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function requestDeletion(user, input) {
  if (input.confirmation !== 'DELETE') throw fail('Type DELETE to confirm account deletion');
  await reauthenticate(user, input);
  const receipt = crypto.randomBytes(32).toString('hex');
  const resumes = await model('Resume').find({ owner: user._id }).select('originalFileStorage originalFileUrl originalFileName fileType');
  try { await Deletion.create({ owner: user._id, emailHash: emailHash(user.email), receiptHash: digest(receipt), files: resumes.map((item) => ({ originalFileStorage: item.originalFileStorage?.toObject?.() || item.originalFileStorage, originalFileUrl: item.originalFileUrl })) }); }
  catch (error) { if (error.code === 11000) throw fail('Account deletion has already been requested', 409); throw error; }
  await User.updateOne({ _id: user._id }, { $set: { deleting: true }, $inc: { authVersion: 1 } });
  await model('AuthSession').deleteMany({ owner: user._id });
  require('../config/socket').disconnectUserSockets(user._id);
  return { receipt, status: 'pending', message: 'Account access is disabled. Data deletion continues in the background. Keep this receipt to check completion.' };
}
async function deletionStatus(receipt) {
  if (typeof receipt !== 'string' || !/^[a-f0-9]{64}$/.test(receipt)) throw fail('Deletion receipt not found', 404);
  const record = await Deletion.findOne({ receiptHash: digest(receipt) });
  if (!record) throw fail('Deletion receipt not found', 404);
  return { status: record.status, requestedAt: record.createdAt, completedAt: record.completedAt || null, receiptExpiresAt: record.expiresAt || null };
}
async function applyRetention(user) {
  const settings = preferences(user), owner = user._id, cutoff = new Date(Date.now() - settings.activityDays * 86400000);
  const jobs = await model('ProcessingJob').find({ owner, status: { $in: ['COMPLETED', 'FAILED', 'CANCELLED'] }, completedAt: { $lt: cutoff } }).select('_id');
  const ids = jobs.map((item) => item._id);
  await model('ProcessingLog').deleteMany({ owner, $or: [{ jobId: { $in: ids } }, { createdAt: { $lt: cutoff } }] });
  await model('JobPayload').deleteMany({ owner, $or: [{ jobId: { $in: ids } }, { expiresAt: { $lte: new Date() } }] });
  await model('JobPayload').updateMany({ owner }, [{ $set: { expiresAt: { $min: ['$expiresAt', { $add: ['$createdAt', settings.retryInputHours * 3600000] }] } } }]);
  await model('JobPayload').deleteMany({ owner, expiresAt: { $lte: new Date() } });
  await model('ProcessingJob').deleteMany({ owner, _id: { $in: ids } });
  await model('Notification').deleteMany({ owner, createdAt: { $lt: cutoff } });
  await model('ProductEvent').deleteMany({ owner, createdAt: { $lt: cutoff } });
  await model('AssessmentCache').deleteMany({ owner, $or: [{ createdAt: { $lt: new Date(Date.now() - settings.cacheDays * 86400000) } }, { expiresAt: { $lte: new Date() } }] });
}
async function finishDeletion(record) {
  const owner = record.owner, token = record.leaseOwner, filter = { _id: record._id, leaseOwner: token };
  await User.updateOne({ _id: owner }, { $set: { deleting: true } });
  if (await model('AccountOperation').exists({ owner, expiresAt: { $gt: new Date() } })) throw new Error('Waiting for active requests');
  await model('Resume').updateMany({ owner }, { $set: { deleting: true } });
  const jobs = await model('ProcessingJob').find({ owner }).select('_id');
  const ids = jobs.map((item) => item._id);
  await model('ProcessingJob').updateMany({ owner, status: { $in: ['PENDING', 'RUNNING', 'RETRYING'] } }, { $set: { status: 'CANCELLED', completedAt: new Date() }, $unset: { 'inputRef.rawInput': 1 } });
  ids.forEach(require('./jobContext').abortJob);
  if (await model('ProcessingJob').exists({ owner, $or: [{ status: 'COMMITTING', leaseExpiresAt: { $gt: new Date() } }, { executionExpiresAt: { $gt: new Date() } }] })) throw new Error('Waiting for active workers');
  // Refresh after requests and workers drain; persist the manifest before deleting records.
  const originals = await model('Resume').find({ owner }).select('originalFileStorage originalFileUrl');
  const files = [...new Map([...record.files, ...originals.map((item) => ({ originalFileStorage: item.originalFileStorage?.toObject?.() || item.originalFileStorage, originalFileUrl: item.originalFileUrl }))].map((item) => [JSON.stringify(item), item])).values()];
  await Deletion.updateOne(filter, { $set: { files } });
  for (const original of files) await require('../config/cloudinary').deleteFile(original);
  const sessions = await model('InterviewSession').find({ owner }).select('_id');
  const resumes = await model('Resume').find({ owner }).select('_id');
  await model('InterviewQuestion').deleteMany({ sessionId: { $in: sessions.map((item) => item._id) } });
  await model('ResumeVersionCounter').deleteMany({ _id: { $in: resumes.map((item) => item._id) } });
  await model('AccountMail').deleteMany({ $or: [{ owner }, { emailHash: record.emailHash }] });
  await model('AccountOperation').deleteMany({ owner });
  for (const name of ownedCollections) await model(name).deleteMany({ owner });
  await User.deleteOne({ _id: owner, deleting: true });
  await Deletion.updateOne(filter, { $set: { status: 'completed', completedAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) }, $unset: { owner: 1, emailHash: 1, files: 1, leaseOwner: 1, leaseExpiresAt: 1, nextAttemptAt: 1 } });
}
async function sweepDeletions() {
  for (let index = 0; index < 20; index++) {
    const now = new Date(), leaseOwner = crypto.randomUUID();
    const record = await Deletion.findOneAndUpdate({ nextAttemptAt: { $lte: now }, $or: [{ status: { $in: ['pending', 'retrying'] } }, { status: 'running', leaseExpiresAt: { $lt: now } }] },
      { $set: { status: 'running', leaseOwner, leaseExpiresAt: new Date(Date.now() + 90000) }, $inc: { attempts: 1 } }, { new: true });
    if (!record) break;
    const heartbeat = setInterval(() => Deletion.updateOne({ _id: record._id, leaseOwner }, { $set: { leaseExpiresAt: new Date(Date.now() + 90000) } }).catch(() => {}), 10000); heartbeat.unref?.();
    try { await finishDeletion(record); }
    catch { await Deletion.updateOne({ _id: record._id, leaseOwner }, { $set: { status: 'retrying', nextAttemptAt: new Date(Date.now() + Math.min(300000, 5000 * record.attempts)) }, $unset: { leaseOwner: 1, leaseExpiresAt: 1 } }); }
    finally { clearInterval(heartbeat); }
  }
}
async function sweepRetention() {
  for await (const user of User.find({ deleting: { $ne: true } }).cursor()) await applyRetention(user);
}
let timer, running, lastRetention = 0;
function tick() {
  if (running) return running;
  running = (async () => { await sweepDeletions(); if (Date.now() - lastRetention > 900000) { await sweepRetention(); lastRetention = Date.now(); } })().finally(() => { running = null; }); return running;
}
function start() { timer = setInterval(() => tick().catch(() => {}), 5000); timer.unref?.(); tick().catch(() => {}); }
async function stop() { clearInterval(timer); await running; }
module.exports = { get, save, preferences, exportData, requestDeletion, deletionStatus, sweepDeletions, sweepRetention, applyRetention, start, stop };
