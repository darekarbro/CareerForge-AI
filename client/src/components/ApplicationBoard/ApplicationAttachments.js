import React, { useState } from 'react';
import api from '../../services/api';
export default function ApplicationAttachments({ application, onChanged }) {
  const [record, setRecord] = useState(application), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const change = async (operation) => {
    setBusy(true); setError('');
    try { const response = await operation(); setRecord(response.data.data); onChanged(response.data.data); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to update attachments. Please retry.'); }
    finally { setBusy(false); }
  };
  return <fieldset className="sm:col-span-2 border-2 p-3 space-y-2"><legend className="font-semibold">Attachments</legend><p className="text-xs">Up to five PDF, DOCX or TXT files, 2 MB each. Files are private to this account.</p><ul className="space-y-2">{(record.attachments || []).map((file) => <li key={file._id} className="flex flex-wrap gap-3 text-sm"><button type="button" className="underline" onClick={() => api.download('/applications/' + record._id + '/attachments/' + file._id, file.name).catch(() => setError('Unable to download attachment.'))}>{file.name} ({Math.ceil(file.bytes / 1024)} KB)</button><button type="button" className="underline" disabled={busy} onClick={() => change(() => api.delete('/applications/' + record._id + '/attachments/' + file._id, { data: { revision: record.revision } }))}>Remove {file.name}</button></li>)}</ul><label className="block text-sm">Upload attachment<input className="block mt-1 max-w-full" type="file" accept=".pdf,.docx,.txt" disabled={busy || record.attachments?.length >= 5} onChange={(event) => { const file = event.target.files[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Choose a file 2 MB or smaller.'); return; } const body = new FormData(); body.append('file', file); body.append('revision', String(record.revision)); change(() => api.post('/applications/' + record._id + '/attachments', body, { headers: { 'Content-Type': 'multipart/form-data' } })); event.target.value = ''; }} /></label>{error && <p role="alert" className="text-sm">{error}</p>}</fieldset>;
}
