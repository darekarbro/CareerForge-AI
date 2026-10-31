import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { subscribeToNotifications } from '../services/socket';
import { useAuthStore } from '../store/authStore';

export function useNotifications() {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [notifications, setNotifications] = useState([]), [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  const currentUser = () => useAuthStore.getState().user?.id || useAuthStore.getState().user?._id;
  const refresh = useCallback(async () => {
    if (!userId) return;
    const requestGeneration = generation.current;
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      if (requestGeneration !== generation.current || currentUser() !== userId) return;
      setNotifications(response.data.data || []);
      setUnreadCount(response.data.unreadCount || 0);
      setError('');
    } catch (failure) {
      if (requestGeneration === generation.current && currentUser() === userId) setError(failure.response?.data?.message || 'Unable to load activity');
    } finally {
      if (requestGeneration === generation.current && currentUser() === userId) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    generation.current++;
    setNotifications([]); setUnreadCount(0); setError(''); setLoading(false);
    if (!userId) return;
    refresh();
    const stop = subscribeToNotifications(userId, (notification) => {
      // Invalidate a list request that started before this live event.
      generation.current++;
      setLoading(false);
      setNotifications((previous) => [notification, ...previous.filter((item) => item._id !== notification._id)].slice(0, 20));
      if (!notification.isRead) setUnreadCount((previous) => previous + 1);
    });
    return () => { invalidateRequests(); stop(); };
  }, [userId, refresh, invalidateRequests]);
  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      generation.current++;
      setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0); setError('');
    } catch { setError('Unable to mark notifications as read'); }
  };
  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear');
      generation.current++;
      setNotifications([]); setUnreadCount(0); setError('');
    } catch { setError('Unable to clear notifications'); }
  };
  return { notifications, unreadCount, loading, error, refresh, markAllRead, clearAll };
}
