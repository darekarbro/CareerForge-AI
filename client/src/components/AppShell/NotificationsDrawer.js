import React from 'react';
import Link from 'next/link';
import { Bell, X, Check, Trash2 } from 'lucide-react';

export default function NotificationsDrawer({ isOpen, onClose, notifications = [], loading = false, error = '', onMarkAllRead, onClearAll }) {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
    <div role="dialog" aria-modal="true" aria-label="Notifications" className="w-full max-w-md bg-[#f5f0e8] border-l-4 border-[#1a1a1a] flex flex-col h-full">
      <div className="p-4 border-b-3 border-[#1a1a1a] bg-[#ffcc00] flex justify-between">
        <h3 className="font-headline font-black uppercase flex gap-2"><Bell className="w-5 h-5" />Recent activity</h3>
        <button type="button" aria-label="Close notifications" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>
      <div className="p-3 bg-white border-b-2 border-black flex justify-between text-xs font-bold">
        <button type="button" onClick={onMarkAllRead} className="flex gap-1"><Check className="w-4 h-4" />Mark all read</button>
        <button type="button" onClick={onClearAll} className="flex gap-1"><Trash2 className="w-4 h-4" />Clear all</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && <p role="alert" className="text-red-800 text-sm">{error}</p>}
        {loading && !notifications.length ? <p role="status">Loading activity...</p> : !notifications.length ?
          <p className="text-sm text-gray-600">No recent activity.</p> : notifications.map((item) =>
            <div key={item._id} className={'brutal-card p-3 bg-white ' + (!item.isRead ? 'border-l-8 border-l-[#0055ff]' : '')}>
              <h4 className="font-bold text-sm">{item.title}</h4>
              <p className="text-xs my-2">{item.message}</p>
              <time className="text-[10px] text-gray-500">{new Date(item.createdAt).toLocaleString()}</time>
              {item.actionLink && <Link href={item.actionLink} onClick={onClose} className="block text-xs font-bold underline mt-2">View result</Link>}
            </div>)}
      </div>
    </div>
  </div>;
}
