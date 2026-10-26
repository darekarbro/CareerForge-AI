const express = require('express');
const mongoose = require('mongoose');
const providerFactory = require('../providers/providerFactory');
const { isRedisAvailable } = require('../queues/processingQueue');

const router = express.Router();

router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const providers = providerFactory.getProvidersStatus();

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'healthy' : 'not_ready',
    timestamp: new Date().toISOString(),
    service: 'CareerForge AI Platform API',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
    },
    queue: {
      mode: isRedisAvailable() ? 'BullMQ (Redis)' : 'In-Memory Async Queue Fallback',
    },
    aiProviders: providers,
  });
});

module.exports = router;
