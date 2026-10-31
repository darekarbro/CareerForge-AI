const mongoose = require('mongoose');
const env = require('./env');
let mongoServer = null;

const connectDB = async ({ uri = env.MONGODB_URI, memoryOptions = {} } = {}) => {
  mongoose.set('bufferCommands', false);
  let connection;
  if (uri) {
    try { connection = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: false }); }
    catch (error) {
      if (env.NODE_ENV === 'production') throw error;
      await mongoose.disconnect();
      console.warn('Configured MongoDB is unavailable; using a temporary development database.');
    }
  }
  if (!connection) {
    if (env.NODE_ENV === 'production') throw new Error('Production requires an available MONGODB_URI');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create(memoryOptions);
    connection = await mongoose.connect(mongoServer.getUri(), { serverSelectionTimeoutMS: 5000, autoIndex: false });
  }
  // Remove the legacy empty UID without changing real Firebase identities.
  await require('./migrateData').migrateData();
  return connection;
};
const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) { await mongoServer.stop(); mongoServer = null; }
};
module.exports = { connectDB, disconnectDB };
