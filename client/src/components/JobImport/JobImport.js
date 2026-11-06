import React, { useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';

export default function JobImport({ onPreview, onManual }) {
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [preview, setPreview] = useState(null), [error, setError] = useState('');
  const load = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setPreview(null);
    try { const response = await api.post('/workspaces/import-preview', { url }); setPreview(response.data.data); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to import this posting. You can paste the details manually below.'); }
    finally { setBusy(false); }
  };
  return <section className="brutal-card p-5 space-y-3" aria-labelledby="job-import-heading">
    <h2 id="job-import-heading" className="font-bold text-xl">Import a job</h2>
    <p className="text-sm">Paste a public Greenhouse or Lever posting. Preview the details, then edit them in the new job form before saving.</p>
    <form onSubmit={load} className="flex flex-wrap items-end gap-3"><label className="text-sm font-semibold grow">Job posting URL<input type="url" required maxLength={2048} value={url} onChange={(event) => { setUrl(event.target.value); setPreview(null); setError(''); }} placeholder="https://boards.greenhouse.io/company/jobs/12345" className="brutal-input block w-full mt-1" /></label><button disabled={busy} className="brutal-btn-primary px-4 py-3 text-sm">{busy ? 'Loading preview…' : 'Preview import'}</button></form>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {preview && <div className="border-2 border-black p-4 space-y-3" role="region" aria-label="Job import preview">
      <h3 className="font-bold">{preview.fields.title} at {preview.fields.company}</h3>
      <p className="text-sm">Imported from {preview.source.provider}. <a href={preview.source.url} target="_blank" rel="noreferrer" className="underline">View original posting</a></p>
      <p className="whitespace-pre-wrap max-h-64 overflow-y-auto text-sm">{preview.fields.description}</p>
      <ul className="text-sm list-disc pl-5">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      {preview.duplicate ? <p className="text-sm font-semibold">A matching job is already saved. <Link className="underline text-blue-700" href={'/workspaces/' + preview.duplicate.workspaceId}>{preview.duplicate.archived ? 'Open archived workspace to restore it' : 'Open existing workspace'}</Link></p> : <button type="button" className="brutal-btn-primary px-4 py-2 text-sm" onClick={() => onPreview(preview.fields)}>Use preview in editable job form</button>}
    </div>}
    <button type="button" onClick={() => { setPreview(null); setError(''); onManual?.(); }} className="underline text-sm font-semibold">Enter job details manually</button>
  </section>;
}
