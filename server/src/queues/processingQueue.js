const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const env = require('../config/env');

class InMemoryQueue {
  constructor({ processor = (data) => require('../agents/orchestrator').runJob(data.jobId), concurrency = 5 } = {}) {
    this.jobs = new Map(); this.pending = []; this.running = 0; this.processor = processor;
    this.concurrency = concurrency; this.closed = false; this.idle = [];
  }
  async add(name, data) {
    if (this.closed) throw new Error('Queue is shutting down');
    const id = String(data.jobId);
    if (!this.jobs.has(id)) {
      this.jobs.set(id, { name, data }); this.pending.push(id);
      setImmediate(() => this.drain());
    }
    return { id };
  }
  drain() {
    while (this.running < this.concurrency && this.pending.length) {
      const id = this.pending.shift(), entry = this.jobs.get(id);
      this.running++;
      Promise.resolve().then(() => this.processor(entry.data)).catch((error) => {
        console.error('Background processing failed:', error.message);
      }).finally(() => {
        this.jobs.delete(id); this.running--; this.drain();
        if (!this.running && !this.pending.length) this.idle.splice(0).forEach((resolve) => resolve());
      });
    }
  }
  async close() {
    this.closed = true;
    if (this.running || this.pending.length) await new Promise((resolve) => this.idle.push(resolve));
  }
}
const inMemoryQueue = new InMemoryQueue();
let queue, worker, producer, workerConnection, initialized = false, available = false, closed = false;
function initQueue() {
  if (initialized || closed) return;
  initialized = true;
  if (!env.REDIS_URL) return;
  try {
    // ioredis parses the complete URL, including its logical database and escaped credentials.
    producer = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false,
      connectTimeout: 2000, retryStrategy: (times) => Math.min(times * 500, 5000) });
    producer.on('ready', () => { available = true; });
    producer.on('error', () => { available = false; });
    producer.on('close', () => { available = false; });
    workerConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, connectTimeout: 2000 });
    workerConnection.on('error', () => {});
    queue = new Queue('careerforge_jobs', { connection: producer });
    queue.on('error', () => { available = false; });
    worker = new Worker('careerforge_jobs', (job) => require('../agents/orchestrator').runJob(job.data.jobId), {
      connection: workerConnection, concurrency: 5, lockDuration: 180000, lockRenewTime: 60000,
    });
    worker.on('error', () => { available = false; });
    worker.on('failed', (_job, error) => console.error('Background processing failed:', error.message));
  } catch (error) { available = false; console.warn('Using local queue:', error.message); }
}
async function enqueueJob(jobType, data) {
  if (closed) { const error = new Error('Server is shutting down'); error.statusCode = 503; throw error; }
  initQueue();
  if (available && queue) {
    let timer;
    try {
      return await Promise.race([
        queue.add(jobType, data, { jobId: String(data.jobId), attempts: 1, removeOnComplete: 100, removeOnFail: 100 }),
        new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Queue request timed out')), 2500); }),
      ]);
    } catch (_error) { available = false; }
    finally { clearTimeout(timer); }
  }
  // Worker claims the MongoDB job atomically, preventing double execution after an ambiguous Redis failure.
  return inMemoryQueue.add(jobType, data);
}
async function closeQueue() {
  closed = true;
  await inMemoryQueue.close();
  if (worker) await worker.close();
  if (queue) await queue.close();
  producer?.disconnect(); workerConnection?.disconnect();
  available = false;
}
module.exports = { enqueueJob, initQueue, closeQueue, InMemoryQueue, isRedisAvailable: () => available };
