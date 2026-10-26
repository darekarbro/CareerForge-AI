const http = require('node:http');
const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocket, closeSocket } = require('./config/socket');
const { initQueue, closeQueue } = require('./queues/processingQueue');
const { createShutdown } = require('./services/shutdown');

async function startServer() {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server, env.CLIENT_URL);
  initQueue();
  require('./services/jobRecovery').start();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.PORT, () => { server.off('error', reject); resolve(); });
  });
  console.log('CareerForge API listening on port ' + server.address().port);
  const shutdown = createShutdown({ server, closeSockets: closeSocket, closeWorkers: async () => { require('./services/jobRecovery').stop(); await closeQueue(); }, disconnectDatabase: disconnectDB });
  const onSignal = () => shutdown().then(() => process.exit(0)).catch((error) => {
    console.error(error.message); process.exit(1);
  });
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  return { server, shutdown };
}
if (require.main === module) startServer().catch((error) => { console.error('Startup failed:', error.message); process.exitCode = 1; });
module.exports = { startServer };
