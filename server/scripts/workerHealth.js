const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
  const ready = await require('../src/models/WorkerHeartbeat').exists({ updatedAt: { $gt: new Date(Date.now() - 45000) } });
  await mongoose.disconnect(); process.exit(ready ? 0 : 1);
})().catch(() => process.exit(1));
