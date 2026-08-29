import React, { useEffect, useState } from 'react';
import { Bell, X, Check, Trash2, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function NotificationsDrawer({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear');
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-none">
      <div className="w-full max-w-md bg-[#f5f0e8] border-l-4 border-[#1a1a1a] shadow-2xl flex flex-col h-full animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-4 border-b-3 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#1a1a1a]" />
            <h3 className="font-headline font-black text-lg text-[#1a1a1a] uppercase tracking-wide">
              Timeline Notifications
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-[#1a1a1a] bg-white hover:bg-[#e63b2e] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="p-3 border-b-2 border-[#1a1a1a] bg-white flex justify-between text-xs font-bold uppercase">
          <button
            onClick={markAllRead}
            className="hover:underline text-[#0055ff] flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Mark All Read
          </button>
          <button
            onClick={clearAll}
            className="hover:underline text-[#e63b2e] flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-10 font-bold uppercase text-sm">Loading activity...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-600 font-medium">
              No recent notifications. Background agent activities will appear here in real-time.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item._id}
                className={`p-3 border-2 border-[#1a1a1a] bg-white shadow-brutal transition-all ${
                  !item.isRead ? 'border-l-8 border-l-[#0055ff]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-headline font-bold text-sm text-[#1a1a1a]">
                    {item.title}
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-gray-700 font-normal leading-relaxed">{item.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
