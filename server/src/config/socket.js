const { Server } = require('socket.io');
const mongoose = require('mongoose');
const env = require('./env');
const ProcessingJob = require('../models/ProcessingJob');

let io = null, publisher, subscriber, emitter, sessionCheck, closed = false;
function setupRedis() {
  if (closed || !env.REDIS_URL || publisher) return;
  const Redis = require('ioredis');
  publisher = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2000 });
  publisher.on('error', () => {});
  // Adapter/emitter publish is fire-and-forget. Lost live events are recovered by API polling.
  const publish = publisher.publish.bind(publisher);
  publisher.publish = (...args) => publish(...args).catch(() => 0);
  emitter = new (require('@socket.io/redis-emitter').Emitter)(publisher);
}
const initSocket = (httpServer, allowedOrigin) => {
  closed = false;
  io = new Server(httpServer, {
    cors: { origin: (allowedOrigin || env.CLIENT_URL).split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
  });
  setupRedis();
  if (publisher) {
    // The adapter subscribes immediately, before the connection's ready event.
    subscriber = publisher.duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null }); subscriber.on('error', () => {});
    io.adapter(require('@socket.io/redis-adapter').createAdapter(publisher, subscriber));
  }
  io.use(async (socket, next) => {
    try {
      const { decoded } = await require('../services/sessionService').authenticate(socket.handshake.auth?.token);
      socket.data.userId = String(decoded.id);
      socket.data.sessionId = decoded.sid;
      socket.data.expiresAt = decoded.exp * 1000;
      next();
    } catch (_error) { next(new Error('Not authorized')); }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join('user:' + userId);
    socket.join('session:' + socket.data.sessionId);
    const expiry = setTimeout(() => socket.disconnect(true), Math.min(2147483647, Math.max(1, socket.data.expiresAt - Date.now())));
    expiry.unref?.(); socket.on('disconnect', () => clearTimeout(expiry));
    socket.on('join_user', (requestedId, acknowledge) => {
      const authorized = String(requestedId) === userId;
      if (authorized) socket.join('user:' + userId);
      if (typeof acknowledge === 'function') acknowledge({ success: authorized });
    });
    socket.on('leave_user', (requestedId) => {
      if (String(requestedId) === userId) socket.leave('user:' + userId);
    });
    socket.on('join_job', async (jobId, acknowledge) => {
      try {
        const authorized = mongoose.isValidObjectId(jobId) &&
          await ProcessingJob.exists({ _id: jobId, owner: userId });
        if (authorized) await socket.join('job:' + jobId);
        if (typeof acknowledge === 'function') acknowledge({ success: Boolean(authorized) });
      } catch (_error) {
        if (typeof acknowledge === 'function') acknowledge({ success: false });
      }
    });
    socket.on('leave_job', (jobId) => socket.leave('job:' + jobId));
  });
  sessionCheck = setInterval(async () => {
    for (const socket of io?.sockets.sockets.values() || []) {
      try { await require('../services/sessionService').authenticate(socket.handshake.auth.token); }
      catch (error) { if (error.statusCode === 401) socket.disconnect(true); }
    }
  }, 30000); sessionCheck.unref?.();
  return io;
};
const getIO = () => io;
const emitAgentEvent = (jobId, userId, eventData) => {
  if (!io) setupRedis();
  const output = io || emitter;
  if (!output) return;
  const rooms = [jobId && 'job:' + jobId, userId && 'user:' + userId].filter(Boolean);
  if (rooms.length) output.to(rooms).emit('agent_event', {
    jobId: jobId && String(jobId), ...eventData, timestamp: eventData.timestamp || new Date(),
  });
};
const emitNotification = (userId, notification) => {
  if (!io) setupRedis();
  if ((io || emitter) && userId) (io || emitter).to('user:' + userId).emit('notification', notification);
};
const disconnectUserSockets = (id) => { if (!io) setupRedis(); (io || emitter)?.in('user:' + id).disconnectSockets(true); };
const disconnectSessionSockets = (id) => { if (!io) setupRedis(); (io || emitter)?.in('session:' + id).disconnectSockets(true); };
const closeSocket = async () => {
  closed = true;
  clearInterval(sessionCheck);
  const closing = io;
  io = null;
  if (closing) await new Promise((resolve) => closing.close(resolve));
  publisher?.disconnect(); subscriber?.disconnect(); publisher = null; subscriber = null; emitter = null;
};
module.exports = { initSocket, getIO, emitAgentEvent, emitNotification, closeSocket, disconnectUserSockets, disconnectSessionSockets };
