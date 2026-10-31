import React from 'react';
export default function DraftToolbar({ draft, saving, error, onSave, onReload }) {
  return <div className="space-y-3 sticky top-[72px] z-20">
    <div className="border-2 border-[#1a1a1a] bg-white p-3 flex flex-wrap items-center justify-between gap-3 shadow-brutal">
      <p role="status" className="text-sm">{saving ? 'Saving…' : draft.dirty ? 'Draft saved on this device' : 'All changes saved'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={draft.undo} disabled={!draft.canUndo || saving} className="border-2 border-[#1a1a1a] px-3 py-2 text-sm disabled:opacity-40">Undo</button>
        <button type="button" onClick={draft.redo} disabled={!draft.canRedo || saving} className="border-2 border-[#1a1a1a] px-3 py-2 text-sm disabled:opacity-40">Redo</button>
        <button type="button" onClick={onSave} disabled={saving || !draft.dirty || draft.conflict} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">Save now</button>
      </div>
    </div>
    {draft.storageError && <p role="alert" className="bg-red-50 p-3 text-sm">Browser storage is unavailable. Save your changes before leaving this page.</p>}
    {error && <p role="alert" className="bg-red-50 border-2 border-red-800 p-3 text-sm">{error}</p>}
    {draft.conflict && <div role="alert" className="bg-amber-50 border-2 border-amber-800 p-3 text-sm space-y-2">
      <p>A newer version was saved elsewhere. Your local draft has been kept.</p>
      <button type="button" onClick={onReload} className="underline font-bold">Reload latest and discard this local draft</button>
    </div>}
  </div>;
}
