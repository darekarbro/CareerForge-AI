import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import useOwnedResource from '../../hooks/useOwnedResource';
import { useAuthStore } from '../../store/authStore';
import ApplicationAttachments from './ApplicationAttachments';
const empty = { company: '', roleTitle: '', sourcePlatform: 'LinkedIn', jobLink: '', status: 'saved', salaryRange: '', location: '', notes: '', appliedDate: '', deadline: '', followUpAt: '', interviewAt: '', statusNote: '', notificationPreferences: { inApp: true, calendarAlarm: false, leadMinutes: 60 }, recruiter: { name: '', email: '', phone: '', notes: '' }, workspaceId: '', resumeVersionId: '' };
const dateFields = ['appliedDate', 'deadline', 'followUpAt'];
const localDateTime = (value) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const valueFor = (record) => Object.fromEntries(Object.entries(empty).map(([key, value]) => [key, key === 'interviewAt' ? localDateTime(record?.[key]) : dateFields.includes(key) ? record?.[key]?.slice(0, 10) || '' : record?.[key] || value]));
function Editor({ onClose, onSave, onDelete, initialData, isSaving, error, workspaces, versions, onRecordChanged }) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id), closeRef = useRef();
  const [downloadError, setDownloadError] = useState('');
  const draft = usePersistentDraft('application:' + (initialData?._id || 'new'), { userId, revision: initialData?.revision || 0, value: valueFor(initialData) });
  useEffect(() => { const previous = document.activeElement; closeRef.current?.focus(); return () => previous?.focus?.(); }, []);
  if (!draft.ready) return null;
  const field = (key, value) => draft.change({ ...draft.value, [key]: value });
  const workspaceChanged = (id) => {
    const item = workspaces.find((entry) => entry._id === id);
    draft.change({ ...draft.value, workspaceId: id, ...(item ? { company: item.company, roleTitle: item.title, jobLink: item.jobUrl || '', resumeVersionId: item.latestVersionId || '' } : {}) });
  };
  const save = async (event) => {
    event.preventDefault(); if (isSaving) return;
    try { await onSave({ ...draft.value, interviewAt: draft.value.interviewAt ? new Date(draft.value.interviewAt).toISOString() : '', ...(initialData?._id ? { revision: draft.baseRevision } : {}) }); draft.discard(); } catch { /* The board keeps the error and draft visible. */ }
  };
  const trapFocus = (event) => {
    if (event.key === 'Escape' && !isSaving) onClose();
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled),input,select,textarea,a[href]')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onKeyDown={trapFocus}><div role="dialog" aria-modal="true" aria-labelledby="application-title" className="w-full max-w-2xl bg-[#f5f0e8] border-4 shadow-brutal-xl">
    <header className="p-4 bg-[#ffcc00] border-b-2 flex justify-between items-center"><h2 id="application-title" className="font-bold text-xl">{initialData?._id ? 'Update Tracked Application' : 'Add New Application'}</h2><button ref={closeRef} type="button" aria-label="Close application editor" disabled={isSaving} onClick={onClose} className="border-2 px-3 py-1">×</button></header>
    <form onSubmit={save} className="p-5 grid sm:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto">
      {error && <p role="alert" className="sm:col-span-2 p-3 bg-red-50 text-sm">{error}</p>}
      {draft.conflict && <p role="alert" className="sm:col-span-2 text-sm">Your saved application changed since this draft. Close, refresh and reload the application before saving.</p>}
      {!!workspaces.length && <label className="text-sm font-semibold sm:col-span-2">Saved job workspace<select className="brutal-input block w-full mt-1" value={draft.value.workspaceId} onChange={(event) => workspaceChanged(event.target.value)}><option value="">No linked workspace</option>{workspaces.map((item) => <option key={item._id} value={item._id}>{item.title} at {item.company}</option>)}</select></label>}
      {[['company', 'Company Name *', 'e.g. Google, Stripe'], ['roleTitle', 'Role Title *', 'e.g. Senior Backend Engineer'], ['jobLink', 'Job Posting Link', 'https://...'], ['location', 'Location', 'e.g. Remote'], ['salaryRange', 'Salary range', 'e.g. ₹8–12 LPA']].map(([key, label, placeholder]) => <label key={key} className="font-semibold text-sm">{label}<input type={key === 'jobLink' ? 'url' : 'text'} required={['company', 'roleTitle'].includes(key)} maxLength={key === 'jobLink' ? 2048 : 300} value={draft.value[key]} onChange={(event) => field(key, event.target.value)} placeholder={placeholder} className="brutal-input block w-full mt-1" /></label>)}
      <label className="text-sm font-semibold">Source Platform<select value={draft.value.sourcePlatform} onChange={(event) => field('sourcePlatform', event.target.value)} className="brutal-input block w-full mt-1">{['LinkedIn', 'Internshala', 'Naukri', 'Indeed', 'Company Portal', 'Referral', 'Other'].map((name) => <option key={name}>{name}</option>)}</select></label>
      <label className="text-sm font-semibold">Application stage<select value={draft.value.status} onChange={(event) => field('status', event.target.value)} className="brutal-input block w-full mt-1">{[['saved', 'Saved'], ['applied', 'Applied'], ['oa', 'Online assessment'], ['interview', 'Interview'], ['offer', 'Offer'], ['rejected', 'Rejected']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      {dateFields.map((key) => <label key={key} className="text-sm font-semibold">{key === 'appliedDate' ? 'Applied date' : key === 'deadline' ? 'Application deadline' : 'Follow-up date'}<input type="date" value={draft.value[key]} onChange={(event) => field(key, event.target.value)} className="brutal-input block w-full mt-1" /></label>)}
      <label className="text-sm font-semibold">Interview time (your local timezone)<input type="datetime-local" value={draft.value.interviewAt || ''} onChange={(event) => field('interviewAt', event.target.value)} className="brutal-input block w-full mt-1" /></label>
      <fieldset className="sm:col-span-2 border-2 p-3 space-y-2"><legend className="font-semibold">Reminders for this opportunity</legend><label className="block text-sm"><input type="checkbox" checked={draft.value.notificationPreferences?.inApp !== false} onChange={(e) => field('notificationPreferences', { ...draft.value.notificationPreferences, inApp: e.target.checked })} /> Show in-app reminders</label><label className="block text-sm"><input type="checkbox" checked={draft.value.notificationPreferences?.calendarAlarm === true} onChange={(e) => field('notificationPreferences', { ...draft.value.notificationPreferences, calendarAlarm: e.target.checked })} /> Include calendar alerts in export</label><label className="block text-sm">Reminder lead time<select className="brutal-input ml-2" value={draft.value.notificationPreferences?.leadMinutes ?? 60} onChange={(e) => field('notificationPreferences', { ...draft.value.notificationPreferences, leadMinutes: Number(e.target.value) })}>{[[0, 'At event time'], [15, '15 minutes'], [60, '1 hour'], [1440, '1 day']].map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label><p className="text-xs">Reminders appear while using the app. Calendar alerts run in your calendar after you import the file.</p></fieldset>
      <label className="text-sm font-semibold sm:col-span-2">Timeline update / status reason<input value={draft.value.statusNote || ''} maxLength={300} onChange={(e) => field('statusNote', e.target.value)} className="brutal-input block w-full mt-1" /></label>
      <fieldset className="sm:col-span-2 grid sm:grid-cols-2 gap-3 border-2 p-3"><legend className="font-semibold">Recruiter contact</legend>{[['name', 'Recruiter name'], ['email', 'Recruiter email'], ['phone', 'Recruiter phone'], ['notes', 'Contact notes']].map(([key, label]) => <label key={key} className="text-sm">{label}<input className="brutal-input block w-full mt-1" type={key === 'email' ? 'email' : 'text'} value={draft.value.recruiter?.[key] || ''} maxLength={key === 'notes' ? 2000 : 200} onChange={(e) => field('recruiter', { ...draft.value.recruiter, [key]: e.target.value })} /></label>)}</fieldset>
      {initialData?._id ? <ApplicationAttachments application={initialData} onChanged={(record) => { draft.rebase({ userId, revision: record.revision, value: valueFor(record) }, draft.value); onRecordChanged?.(record); }} /> : <p className="sm:col-span-2 text-xs">Save this application to add attachments.</p>}
      <label className="text-sm font-semibold sm:col-span-2">Resume version used<select value={draft.value.resumeVersionId} onChange={(event) => field('resumeVersionId', event.target.value)} className="brutal-input block w-full mt-1"><option value="">No version selected</option>{versions.map((item) => <option key={item._id} value={item._id}>{item.targetRole} · Version {item.version} · {new Date(item.createdAt).toLocaleDateString()}</option>)}</select></label>
      {initialData?.resumeSnapshot && <p className="text-sm sm:col-span-2">Saved resume: version {initialData.resumeSnapshot.version}, edit revision {initialData.resumeSnapshot.contentRevision}. <button type="button" className="underline" onClick={() => api.download('/applications/' + initialData._id + '/resume', 'application_resume.pdf').catch(() => setDownloadError('Unable to download the saved resume copy. Please retry.'))}>Download the saved copy</button></p>}
      {downloadError && <p role="alert" className="text-sm sm:col-span-2">{downloadError}</p>}
      <label className="text-sm font-semibold sm:col-span-2">Personal Notes / Interview Timeline<textarea aria-label="Personal Notes / Interview Timeline" rows={3} maxLength={10000} value={draft.value.notes} onChange={(event) => field('notes', event.target.value)} placeholder="Referral contact, recruiter notes, interview dates..." className="brutal-input block w-full mt-1" /></label>
      {initialData?.timeline?.length > 0 && <section className="sm:col-span-2 text-sm"><h3 className="font-bold">Status timeline</h3><ol className="space-y-3 mt-3 border-l-2 pl-4">{[...initialData.timeline].reverse().map((item, index) => <li key={item._id || index}><time className="text-xs text-gray-600" dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString()}</time><p className="font-semibold capitalize">{item.status === 'oa' ? 'Online assessment' : item.status}</p><p>{item.note}</p></li>)}</ol></section>}
      <div className="sm:col-span-2 flex flex-wrap justify-between gap-3"><div>{initialData?._id && onDelete && <button type="button" disabled={isSaving} onClick={() => onDelete(initialData._id)} className="brutal-btn-red px-4 py-2 text-sm">Delete</button>}</div><div className="flex gap-3"><button type="button" onClick={onClose} disabled={isSaving} className="border-2 px-4 py-2 text-sm">Cancel</button><button disabled={isSaving || draft.conflict} className="brutal-btn-primary px-4 py-2 text-sm">{isSaving ? 'Saving...' : 'Save Application'}</button></div></div>
    </form>
  </div></div>;
}
export default function ApplicationModal(props) {
  const workspaces = useOwnedResource(props.isOpen ? '/workspaces' : null), versions = useOwnedResource(props.isOpen ? '/applications/resume-versions' : null);
  return props.isOpen ? <Editor {...props} workspaces={workspaces.data || []} versions={versions.data || []} /> : null;
}
