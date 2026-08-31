const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { initSocket } = require('./config/socket');

const startServer = async () => {
  try {
    // 1. Connect database (with automatic in-memory fallback)
    await connectDB();

    // 2. Create HTTP server
    const server = http.createServer(app);

    // 3. Initialize Socket.IO real-time engine
    initSocket(server, env.CLIENT_URL);

    // 4. Start Listening
    server.listen(env.PORT, () => {
      console.log('====================================================');
      console.log(`🚀 CareerForge AI Server running in ${env.NODE_ENV} mode`);
      console.log(`📡 Listening on: http://localhost:${env.PORT}`);
      console.log(`🔗 Health Check: http://localhost:${env.PORT}/api/health`);
      console.log('====================================================');
    });

    // Handle port already in use gracefully
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${env.PORT} is already in use.`);
        console.error(`   → Kill the existing process: npx kill-port ${env.PORT}`);
        console.error(`   → Or change PORT in server/.env\n`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err.message);
        process.exit(1);
      }
    });

    // Graceful shutdown handling
    const shutdown = () => {
      console.log('\n🛑 Gracefully shutting down CareerForge AI Server...');
      server.close(() => {
        console.log('💤 Closed remaining HTTP & Socket.IO connections.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
