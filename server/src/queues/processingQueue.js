const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const env = require('../config/env');
const orchestrator = require('../agents/orchestrator');

let queue = null;
let worker = null;
let isRedisAvailable = false;

// Simple in-memory asynchronous job dispatcher fallback
class InMemoryQueue {
  constructor() {
    this.jobs = new Map();
  }

  async add(name, data) {
    const jobKey = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.jobs.set(jobKey, { name, data, status: 'queued' });

    // Execute asynchronously on next tick
    setImmediate(async () => {
      try {
        await orchestrator.runJob(data.jobId);
      } catch (err) {
        console.error(`[InMemoryQueue] Execution error for job ${data.jobId}:`, err.message);
      }
    });

    return { id: jobKey };
  }
}

const inMemoryQueue = new InMemoryQueue();

// Initialize BullMQ if REDIS_URL is provided
if (env.REDIS_URL) {
  try {
    // Parse the rediss:// URL manually to handle special chars in password
    let redisOpts;
    try {
      const parsed = new URL(env.REDIS_URL);
      redisOpts = {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 6379,
        username: parsed.username || 'default',
        password: decodeURIComponent(parsed.password),
        tls: parsed.protocol === 'rediss:' ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };
    } catch (_parseErr) {
      // Fallback: pass as raw URL string
      redisOpts = env.REDIS_URL;
    }

    const connection = typeof redisOpts === 'string'
      ? new Redis(redisOpts, { maxRetriesPerRequest: null, enableReadyCheck: false })
      : new Redis(redisOpts);

    connection.on('connect', () => {
      isRedisAvailable = true;
      console.log('✅ Connected to Redis for BullMQ background queue');
    });

    connection.on('error', (err) => {
      console.warn('⚠️ Redis connection error. Reverting to in-memory queue fallback:', err.message);
      isRedisAvailable = false;
    });

    queue = new Queue('careerforge_jobs', { connection });

    worker = new Worker(
      'careerforge_jobs',
      async (bullJob) => {
        return orchestrator.runJob(bullJob.data.jobId);
      },
      { connection, concurrency: 5 }
    );

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
    });
  } catch (err) {
    console.warn('⚠️ BullMQ setup failed. Using in-memory queue fallback:', err.message);
  }
} else {
  console.log('⚡ No REDIS_URL configured. Running with in-memory background queue.');
}

/**
 * Enqueue a processing job
 */
const enqueueJob = async (jobType, data) => {
  if (isRedisAvailable && queue) {
    return queue.add(jobType, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  return inMemoryQueue.add(jobType, data);
};

module.exports = {
  enqueueJob,
  isRedisAvailable: () => isRedisAvailable,
};
