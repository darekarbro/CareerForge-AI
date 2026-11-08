import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';
import useOwnedResource from '../../hooks/useOwnedResource';

const labels = { coverLetter: 'Cover letter', recruiter: 'Recruiter introduction', referral: 'Referral request', followUp: 'Application follow-up' };

function DraftEditor({ pack, stale, disabled, busy, onSave, onCopy, onDownload, checks }) {
  const [kind, setKind] = useState('coverLetter');
  const [body, setBody] = useState(pack.drafts.coverLetter);
  const [confirmed, setConfirmed] = useState(false);
  const dirty = body !== pack.drafts[kind];
  const reviewed = !dirty && pack.reviewed.includes(kind);
  const blocked = disabled || stale || busy;
  return <div className="space-y-3 border-t-2 border-black pt-4">
    <h3 className="font-bold text-lg">Review your drafts</h3>
    <p className="text-sm">Edit each message and check every claim. Review unlocks copying and export. You choose where and when to send it.</p>
    <label className="block text-sm font-semibold">Preparation draft<select value={kind} disabled={busy || dirty} onChange={(event) => { setKind(event.target.value); setBody(pack.drafts[event.target.value]); setConfirmed(false); }} className="brutal-input block w-full mt-1">{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}{pack.reviewed.includes(key) ? ' · Reviewed' : ''}</option>)}</select></label>
    <label className="block text-sm font-semibold">Draft text<textarea rows={12} maxLength={16000} disabled={blocked} value={body} onChange={(event) => { setBody(event.target.value); setConfirmed(false); }} className="brutal-input block w-full mt-1" /></label>
    <p className="text-sm" role="status">{dirty ? 'Unsaved edits. Save or discard them before switching drafts.' : reviewed ? 'Reviewed and saved.' : 'Draft needs your review.'}</p>
    {checks?.[kind]?.length > 0 && <div className="text-sm"><p className="font-semibold">Claims to resolve before review</p><ul className="list-disc pl-5">{checks[kind].map((issue, index) => <li key={index}>{typeof issue === 'string' ? issue : issue.message || issue.reason || JSON.stringify(issue)}</li>)}</ul></div>}
    <label className="flex gap-2 items-start text-sm"><input type="checkbox" disabled={blocked} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I checked this draft against my actual experience</label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={blocked || !dirty} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40" onClick={() => onSave(kind, body, false, false)}>Save draft</button>
      <button type="button" disabled={blocked || !confirmed || reviewed} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40" onClick={() => onSave(kind, body, true, confirmed)}>Mark draft reviewed</button>
      {dirty && <button type="button" disabled={busy} className="border-2 px-4 py-2 text-sm" onClick={() => { setBody(pack.drafts[kind]); setConfirmed(false); }}>Discard draft edits</button>}
      <button type="button" disabled={blocked || !reviewed} className="border-2 px-4 py-2 text-sm disabled:opacity-40" onClick={() => onCopy(kind)}>Copy reviewed draft</button>
      <button type="button" disabled={blocked || dirty || !pack.reviewed.includes('coverLetter')} className="brutal-btn-yellow px-4 py-2 text-sm disabled:opacity-40" onClick={onDownload}>Download preparation pack</button>
    </div>
  </div>;
}

export default function PreparationPack({ workspaceId, disabled = false, refreshKey }) {
  const url = workspaceId ? '/workspaces/' + workspaceId + '/pack' : null;
  const resource = useOwnedResource(url);
  const { reload } = resource;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const identity = resource.userId + ':' + workspaceId;
  const active = useRef(identity); active.current = identity;
  const previous = useRef(refreshKey);
  useEffect(() => { if (previous.current !== refreshKey) { previous.current = refreshKey; reload(); } }, [refreshKey, reload]);
  async function perform(action) {
    const expected = identity; setBusy(true); setError(''); setMessage('');
    try { await action(() => active.current === expected); }
    catch (failure) { if (active.current === expected) setError(failure.response?.data?.message || failure.message || 'Unable to update the preparation pack.'); }
    finally { if (active.current === expected) setBusy(false); }
  }
  const state = resource.data, pack = state?.pack;
  async function generate() {
    await perform(async (current) => { await api.post(url, pack ? { revision: pack.revision } : {}); if (current()) await resource.reload(); });
  }
  async function save(kind, body, reviewed, confirmed) {
    await perform(async (current) => { await api.put(url, { revision: pack.revision, kind, body, reviewed, confirmed }); if (current()) { await resource.reload(); setMessage(reviewed ? 'Draft reviewed and saved.' : 'Draft saved. Review is required before copying.'); } });
  }
  async function copy(kind) {
    await perform(async (current) => {
      const response = await api.get(url + '/drafts/' + kind);
      if (!current()) return;
      await navigator.clipboard.writeText(response.data.data.body);
      if (current()) setMessage('Reviewed draft copied. Paste it into your chosen messaging app when you are ready.');
    });
  }
  return <section className="brutal-card p-5 space-y-4" aria-labelledby="preparation-pack-heading">
    <h2 id="preparation-pack-heading" className="text-xl font-bold">Application preparation pack</h2>
    <p className="text-sm">Your selected resume, cover letter, project examples, interview topics and reviewed outreach drafts in one place. The download includes your current preparation checklist.</p>
    {resource.loading && !pack ? <p role="status">Loading preparation pack…</p> : resource.error ? <p role="alert">{resource.error} <button className="underline" onClick={() => resource.reload()}>Retry</button></p> : <>
      {state?.stale && <p role="alert" className="text-sm font-semibold">The job, resume or confirmed evidence changed. Regenerate the pack and review the new drafts.</p>}
      <button type="button" disabled={disabled || busy} onClick={generate} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">{busy ? 'Working…' : pack ? 'Regenerate preparation pack' : 'Create preparation pack'}</button>
      {pack && <>
        <p className="text-sm">Selected resume: <Link className="underline text-blue-700" href={'/resume/' + pack.snapshot.resumeId + '/edit'}>{pack.snapshot.resumeTitle}</Link> · revision {pack.snapshot.resumeRevision} · {pack.snapshot.resumeVerified ? 'Verified by you' : 'Not verified by you'}</p>
        <p className="text-sm">Regenerating replaces these drafts and clears their review status.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          <section><h3 className="font-bold text-lg">Relevant project examples</h3>{pack.snapshot.projects.length ? <ul className="space-y-3 mt-2">{pack.snapshot.projects.map((project) => <li key={project.entryId}><p className="font-semibold text-sm">{project.title}</p><p className="text-sm whitespace-pre-wrap">{project.description}</p>{project.highlights?.length > 0 && <ul className="list-disc pl-5 text-sm">{project.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul>}<p className="text-xs mt-1">{project.citations.length ? project.citations.length + ' confirmed facts linked to this example' : 'No confirmed facts linked; verify before describing this project in outreach.'}</p></li>)}</ul> : <p className="text-sm mt-2">No projects are included in the selected resume entries.</p>}</section>
          <section><h3 className="font-bold text-lg">Interview topics</h3><ul className="space-y-3 mt-2">{pack.snapshot.topics.map((topic) => <li key={topic.title} className="text-sm"><p className="font-semibold">{topic.title} · {topic.supported ? 'Confirmed evidence available' : 'Prepare or clarify'}</p><p>{topic.prompt}</p></li>)}</ul></section>
        </div>
        <details className="text-sm"><summary className="font-bold cursor-pointer">Evidence used</summary>{pack.snapshot.evidence.length ? <ul className="space-y-3 mt-2">{pack.snapshot.evidence.map((fact) => <li key={fact.id}><Link href={'/evidence?search=' + encodeURIComponent(fact.title)} className="underline text-blue-700 font-semibold">{fact.title}</Link><p className="whitespace-pre-wrap">{fact.statement}</p><p className="text-xs">{fact.reason} · confirmed fact revision {fact.revision}</p></li>)}</ul> : <p className="mt-2">No confirmed facts in the selected resume scope. Verify your resume or its career evidence before reviewing experience claims.</p>}</details>
        <DraftEditor key={identity + ':' + pack.revision} pack={pack} stale={state.stale} checks={state.checks} disabled={disabled} busy={busy} onSave={save} onCopy={copy} onDownload={() => perform(async () => { await api.download(url + '/download', 'application-preparation.txt'); })} />
        <p className="text-xs">{state.limitations}</p>
      </>}
    </>}
    {error && <p role="alert" className="text-sm">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
