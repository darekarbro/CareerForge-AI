import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
let socket = null, socketToken = null;
const jobs = new Map(), users = new Map();
const storedToken = () => {
  try { return JSON.parse(localStorage.getItem('careerforge_auth') || '{}').token || null; }
  catch { return null; }
};
export const disconnectSocket = () => {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null; socketToken = null;
  jobs.clear(); users.clear();
};
export const getSocket = () => {
  if (typeof window === 'undefined') return null;
  const token = storedToken();
  if (!token) { disconnectSocket(); return null; }
  if (socket && socketToken !== token) disconnectSocket();
  if (!socket) {
    socketToken = token;
    socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity, reconnectionDelay: 1000 });
    const current = socket;
    socket.on('connect', () => {
      for (const id of jobs.keys()) current.emit('join_job', id);
      for (const id of users.keys()) current.emit('join_user', id);
    });
  }
  return socket;
};
function subscribe(room, id, eventName, callback) {
  const current = getSocket();
  if (!current || !id) return () => {};
  id = String(id);
  const registry = room === 'job' ? jobs : users;
  registry.set(id, (registry.get(id) || 0) + 1);
  current.emit('join_' + room, id);
  const handler = (event) => {
    if (room !== 'job' || String(event.jobId) === id) callback(event);
  };
  current.on(eventName, handler);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    current.off(eventName, handler);
    if (socket !== current) return;
    const count = (registry.get(id) || 1) - 1;
    if (count > 0) registry.set(id, count);
    else { registry.delete(id); current.emit('leave_' + room, id); }
  };
}
export const subscribeToJob = (jobId, callback) => subscribe('job', jobId, 'agent_event', callback);
export const subscribeToUserEvents = (userId, callback) => subscribe('user', userId, 'agent_event', callback);
export const subscribeToNotifications = (userId, callback) => subscribe('user', userId, 'notification', callback);
