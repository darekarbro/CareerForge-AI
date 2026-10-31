const { connectDB, disconnectDB } = require('./config/db');
const { initQueue, closeQueue } = require('./queues/processingQueue');
const background = require('./services/backgroundServices');
async function startWorker() {
  const env = require('./config/env');
  if (env.QUEUE_MODE !== 'worker') throw new Error('Start the independent worker with QUEUE_MODE=worker');
  await connectDB(); initQueue(); await background.start();
  console.log('CareerForge background worker ready');
  let closing;
  const shutdown = () => closing ||= (async () => { await background.stop(); await closeQueue(); await require('./config/socket').closeSocket(); await disconnectDB(); })();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown().then(() => process.exit(0)).catch(() => process.exit(1)));
  return { shutdown };
}
if (require.main === module) startWorker().catch((error) => { console.error('Worker startup failed:', error.message); process.exit(1); });
module.exports = { startWorker };
