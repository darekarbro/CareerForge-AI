const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer, allowedOrigin) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Join user room for targeted notifications
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Join specific job room for live timeline updates
    socket.on('join_job', (jobId) => {
      if (jobId) {
        socket.join(`job:${jobId}`);
      }
    });

    socket.on('leave_job', (jobId) => {
      if (jobId) {
        socket.leave(`job:${jobId}`);
      }
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

/**
 * Emits an agent processing event to connected clients for a job and user
 */
const emitAgentEvent = (jobId, userId, eventData) => {
  if (!io) return;
  
  if (jobId) {
    io.to(`job:${jobId}`).emit('agent_event', { jobId, ...eventData, timestamp: new Date() });
  }
  
  if (userId) {
    io.to(`user:${userId}`).emit('agent_event', { jobId, ...eventData, timestamp: new Date() });
  }
  
  // Also emit globally for monitoring / debug dashboard
  io.emit('job_timeline_update', { jobId, userId, ...eventData, timestamp: new Date() });
};

/**
 * Emits a notification to a specific user
 */
const emitNotification = (userId, notification) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit('notification', notification);
};

module.exports = {
  initSocket,
  getIO,
  emitAgentEvent,
  emitNotification,
};
