import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to CareerForge Socket.IO server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });
  }

  return socket;
};

export const subscribeToJob = (jobId, onEvent) => {
  const s = getSocket();
  if (!s || !jobId) return () => {};

  s.emit('join_job', jobId);

  const handler = (data) => {
    if (data.jobId === jobId) {
      onEvent(data);
    }
  };

  s.on('agent_event', handler);

  return () => {
    s.emit('leave_job', jobId);
    s.off('agent_event', handler);
  };
};

export const subscribeToUserEvents = (userId, onEvent) => {
  const s = getSocket();
  if (!s || !userId) return () => {};

  s.emit('join_user', userId);

  s.on('agent_event', onEvent);
  s.on('notification', onEvent);

  return () => {
    s.off('agent_event', onEvent);
    s.off('notification', onEvent);
  };
};
