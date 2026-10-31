const crypto = require('node:crypto');
const env = require('../config/env');
const key = () => crypto.createHash('sha256').update('careerforge-private-payload-v1:' + (env.JOB_PAYLOAD_SECRET || env.JWT_SECRET)).digest();
function seal(value, context) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(context));
  return { ciphertext: Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]), iv, tag: cipher.getAuthTag() };
}
function open(value, context) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), value.iv);
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(value.tag);
  return JSON.parse(Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString('utf8'));
}
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const emailHash = (email) => crypto.createHmac('sha256', key()).update(email.trim().toLowerCase()).digest('hex');
module.exports = { seal, open, digest, emailHash };
