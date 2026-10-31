const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const env = require('./env');
const User = require('../models/User');
const ProcessingJob = require('../models/ProcessingJob');

let io = null;
const initSocket = (httpServer, allowedOrigin) => {
  io = new Server(httpServer, {
    cors: { origin: (allowedOrigin || env.CLIENT_URL).split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token, env.JWT_SECRET, { algorithms: ['HS256'] });
      if (!mongoose.isValidObjectId(decoded.id) || !await User.exists({ _id: decoded.id })) throw new Error('Unknown user');
      socket.data.userId = String(decoded.id);
      next();
    } catch (_error) { next(new Error('Not authorized')); }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join('user:' + userId);
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
  return io;
};
const getIO = () => io;
const emitAgentEvent = (jobId, userId, eventData) => {
  if (!io) return;
  const rooms = [jobId && 'job:' + jobId, userId && 'user:' + userId].filter(Boolean);
  if (rooms.length) io.to(rooms).emit('agent_event', {
    jobId: jobId && String(jobId), ...eventData, timestamp: eventData.timestamp || new Date(),
  });
};
const emitNotification = (userId, notification) => {
  if (io && userId) io.to('user:' + userId).emit('notification', notification);
};
const closeSocket = async () => {
  if (!io) return;
  const closing = io;
  io = null;
  await new Promise((resolve) => closing.close(resolve));
};
module.exports = { initSocket, getIO, emitAgentEvent, emitNotification, closeSocket };
