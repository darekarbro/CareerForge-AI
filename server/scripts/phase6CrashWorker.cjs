// Only launched by the isolated Phase 6 evidence harness, never by production.
require('../test/setup.cjs');
process.on('message', async ({ uri, jobId }) => {
  try {
    const mongoose = require('mongoose'); mongoose.set('bufferCommands', false);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 1000 });
    await require('../src/services/processingJobLifecycle').runProcessingJob(jobId, async () => {
      process.send({ claimed: true, traceId: require('../src/services/telemetry').ids().traceId });
      await new Promise(() => {});
    });
  } catch (error) { process.send({ error: error.message }); process.exit(1); }
});
