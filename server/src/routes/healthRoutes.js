const express = require('express');
const mongoose = require('mongoose');
const providerFactory = require('../providers/providerFactory');
const { isRedisAvailable } = require('../queues/processingQueue');

const router = express.Router();

router.get('/', async (req, res, next) => { try {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const providers = providerFactory.getProvidersStatus();

  const separate = require('../config/env').QUEUE_MODE === 'producer';
  const workerReady = !separate || dbStatus === 'connected' && Boolean(await require('../models/WorkerHeartbeat').exists({ updatedAt: { $gt: new Date(Date.now() - 45000) } }));
  res.status(dbStatus === 'connected' && workerReady ? 200 : 503).json({
    status: dbStatus === 'connected' && workerReady ? 'healthy' : 'not_ready',
    timestamp: new Date().toISOString(),
    service: 'CareerForge AI Platform API',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
    },
    queue: {
      mode: isRedisAvailable() ? 'BullMQ (Redis)' : separate ? 'MongoDB durable queue awaiting worker recovery' : 'In-Memory Async Queue Fallback',
      workerReady,
    },
    aiProviders: providers,
  });
  } catch (error) { next(error); }
});

module.exports = router;
