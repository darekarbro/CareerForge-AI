const crypto = require('node:crypto');
const Payload = require('../models/JobPayload');
const env = require('../config/env');
const key = () => crypto.createHash('sha256').update('careerforge-job-payload-v1:' + (env.JOB_PAYLOAD_SECRET || env.JWT_SECRET)).digest();
const aad = (job) => Buffer.from(String(job.owner) + ':' + String(job._id));
async function save(job, value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(aad(job));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value || {}), 'utf8'), cipher.final()]);
  const user = await require('../models/User').findById(job.owner).select('privacy.retryInputHours');
  await Payload.create({ jobId: job._id, owner: job.owner, ciphertext, iv, tag: cipher.getAuthTag(), expiresAt: new Date(Date.now() + (user?.privacy?.retryInputHours || 24) * 3600000) });
}
async function read(job) {
  if (job.inputRef.rawInput !== undefined) return job.inputRef.rawInput;
  const payload = await Payload.findOne({ jobId: job._id, owner: job.owner, expiresAt: { $gt: new Date() } });
  if (!payload) throw Object.assign(new Error('The retry input has expired. Start this action again from its resume or job workspace.'), { code: 'INPUT_EXPIRED', statusCode: 409 });
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), payload.iv);
    decipher.setAAD(aad(job)); decipher.setAuthTag(payload.tag);
    return JSON.parse(Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]).toString('utf8'));
  } catch { throw Object.assign(new Error('The saved request cannot be recovered with the current server key. Start the action again.'), { code: 'INPUT_UNAVAILABLE', statusCode: 409 }); }
}
const remove = (job) => Payload.deleteOne({ jobId: job._id, owner: job.owner });
module.exports = { save, read, remove };
