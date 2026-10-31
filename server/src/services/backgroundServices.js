const Heartbeat = require('../models/WorkerHeartbeat');
const workerId = require('node:crypto').randomUUID();
let timer;
async function beat() { await Heartbeat.updateOne({ _id: workerId }, { $set: { updatedAt: new Date(), expiresAt: new Date(Date.now() + 60000) } }, { upsert: true }); }
async function start() {
  await beat(); timer = setInterval(() => beat().catch(() => {}), 10000); timer.unref?.();
  require('./jobRecovery').start(); require('./accountMailService').start(); require('./privacyService').start();
}
async function stop() {
  clearInterval(timer); require('./jobRecovery').stop();
  await Promise.all([require('./accountMailService').stop(), require('./privacyService').stop()]);
  await Heartbeat.deleteOne({ _id: workerId });
}
module.exports = { start, stop, workerId };
