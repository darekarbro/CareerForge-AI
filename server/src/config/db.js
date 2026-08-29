const mongoose = require('mongoose');
const env = require('./env');

let mongoServer = null;

const connectDB = async () => {
  try {
    let uri = env.MONGODB_URI;

    if (!uri) {
      console.log('⚡ No MONGODB_URI provided. Starting in-memory MongoDB server...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
        console.log(`📦 In-memory MongoDB running at: ${uri}`);
      } catch (memErr) {
        console.warn('⚠️ Could not start mongodb-memory-server:', memErr.message);
        console.log('🔄 Attempting fallback connection to mongodb://localhost:27017/careerforge');
        uri = 'mongodb://127.0.0.1:27017/careerforge';
      }
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    // Instead of exiting process, keep server alive with limited mock fallback or warn
    console.warn('⚠️ Server running with degraded database state. Please configure MONGODB_URI or start local Mongo.');
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (err) {
    console.error('Error disconnecting DB:', err.message);
  }
};

module.exports = { connectDB, disconnectDB };
