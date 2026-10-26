import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ResumeEditor, { normalizeContent } from './ResumeEditor';
import DraftToolbar from '../DraftToolbar/DraftToolbar';
import AssessmentPanel from './AssessmentPanel';
import ExportPanel from './ExportPanel';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import useDraftSync from '../../hooks/useDraftSync';
import { useAuthStore } from '../../store/authStore';
import { submitProcessingRequest } from '../../services/processing';
import api from '../../services/api';
const decode = (version) => ({ revision: version.contentRevision || 1, value: { content: normalizeContent(version.reviewedContent || version.tailoredContent), decisions: version.reviewDecisions || {} } });
const copy = (value) => JSON.parse(JSON.stringify(value));
export function reviewChanges(version) {
  const source = normalizeContent(version.sourceContent || {}), target = normalizeContent(version.tailoredContent || {}), changes = [];
  const add = (label, before, after, path, key) => { if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ key: key || String(changes.length), label, before, after, path }); };
  add('Professional summary', source.summary, target.summary, ['summary'], 'summary');
  for (const section of ['workExperience', 'projects']) target[section].forEach((item, index) => {
    const original = source[section][index] || {}, label = item.title || [item.role, item.company].filter(Boolean).join(' at ') || section;
    if (section === 'projects') add(label + ' — description', original.description || '', item.description || '', [section, index, 'description']);
    const before = original.highlights || [], after = item.highlights || [];
    if (JSON.stringify([...before].sort()) === JSON.stringify([...after].sort())) add(label + ' — bullet order', before, after, [section, index, 'highlights']);
    else after.forEach((text, line) => add(label + ' — achievement ' + (line + 1), before[line] || '', text, [section, index, 'highlights', line]));
  });
  for (const group of ['technical', 'frameworks', 'tools', 'soft']) add(group + ' skills', source.skills[group], target.skills[group], ['skills', group]);
  return changes;
}
export default function ReviewEditor({ version, onSaved }) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  const [server, setServer] = useState(() => ({ ...decode(version), userId })), [working, setWorking] = useState('');
  const { query } = useRouter(), [suggestion, setSuggestion] = useState(null);
  const draft = usePersistentDraft('version:' + version._id, server);
  const latest = useRef(draft.value); latest.current = draft.value;
  const url = '/resumes/' + version.resumeId + '/versions/' + version._id;
  const sync = useDraftSync(draft, url, decode, (saved, record) => { setServer(saved); onSaved?.(record); });
  const changes = useMemo(() => reviewChanges(version), [version]);
  const decide = (item, decision) => {
    const content = copy(draft.value.content); let parent = content;
    item.path.slice(0, -1).forEach((key) => { parent = parent[key]; });
    parent[item.path.at(-1)] = copy(decision === 'rejected' ? item.before : item.after);
    if (item.path[0] === 'skills') content.skills.all = [...new Set(['technical', 'frameworks', 'tools', 'soft'].flatMap((key) => content.skills[key]))];
    sync.change({ content, decisions: { ...draft.value.decisions, [item.key]: decision } });
  };
  const regenerate = async (selection) => {
    if (working) return;
    const [section, index] = selection.split(':'); setWorking(selection); sync.setError('');
    try {
      const response = await submitProcessingRequest(url + '/regenerate', { section, ...(index === undefined ? {} : { index: Number(index) }) });
      if (!sync.current()) return;
      const result = response.data.data, content = copy(latest.current.content);
      if (section === 'summary') content.summary = result.value; else content[section][Number(index)] = result.value;
      sync.change({ ...latest.current, content });
    } catch (failure) { if (sync.current()) sync.setError(failure.response?.data?.message || 'Unable to rewrite this section'); }
    finally { if (sync.current()) setWorking(''); }
  };
  useEffect(() => {
    if (!query.suggestion) return;
    const controller = new AbortController();
    api.get('/processing-jobs/' + query.suggestion, { signal: controller.signal }).then(({ data }) => {
      const job = data.data;
      if (!controller.signal.aborted && job.status === 'COMPLETED' && job.jobType === 'section_rewrite' && job.inputRef.versionId === version._id) setSuggestion(job.output);
    }).catch(() => {});
    return () => controller.abort();
  }, [query.suggestion, version._id]);
  if (!draft.ready) return <p role="status">Loading your review draft…</p>;
  return <div className="space-y-5">
    <DraftToolbar draft={draft} saving={sync.saving} error={sync.error} onSave={sync.save} onReload={sync.reload} />
    {suggestion && <aside className="brutal-card p-4 space-y-3"><h2 className="font-bold">Recovered section suggestion</h2><p className="text-sm whitespace-pre-line">{typeof suggestion.value === 'string' ? suggestion.value : [suggestion.value.description, ...(suggestion.value.highlights || [])].filter(Boolean).join('\n')}</p><button type="button" className="border-2 px-3 py-2 text-sm" onClick={() => { const content = copy(draft.value.content); if (suggestion.section === 'summary') content.summary = suggestion.value; else content[suggestion.section][suggestion.index] = suggestion.value; sync.change({ ...draft.value, content }); setSuggestion(null); }}>Apply suggestion to draft</button></aside>}
    <p className="text-sm">Review each suggestion, then edit any detail below. Exports use your saved edits. <Link className="underline text-blue-700" href={'/resume/' + version.resumeId + '/edit'}>Add verified facts to the original resume</Link></p>
    <details className="brutal-card p-5" open><summary className="font-semibold cursor-pointer">Review {changes.length} suggested changes</summary>
      <div className="space-y-4 mt-4">{changes.map((item) => <article key={item.key} className="border-2 p-4 space-y-3">
        <h3 className="font-semibold">{item.label}</h3><div className="grid md:grid-cols-2 gap-4 text-sm leading-relaxed"><div><strong>Original</strong><p className="whitespace-pre-line">{Array.isArray(item.before) ? item.before.join('\n') : item.before || 'No original text'}</p></div><div><strong>Suggested</strong><p className="whitespace-pre-line">{Array.isArray(item.after) ? item.after.join('\n') : item.after}</p></div></div>
        {item.reason && <p className="text-sm text-gray-600">{item.reason}</p>}
        <div className="flex items-center gap-3 text-sm"><button type="button" onClick={() => decide(item, 'accepted')} aria-pressed={draft.value.decisions[item.key] === 'accepted'} className="border-2 px-3 py-2 aria-pressed:bg-green-100">Accept</button><button type="button" onClick={() => decide(item, 'rejected')} aria-pressed={draft.value.decisions[item.key] === 'rejected'} className="border-2 px-3 py-2 aria-pressed:bg-red-100">Keep original</button><span>{draft.value.decisions[item.key] || 'Pending review'}</span></div>
      </article>)}</div>
    </details>
    <div className="brutal-card p-4 flex flex-wrap gap-3 items-end">
      <label className="text-sm font-semibold">Rewrite one section<select id={'rewrite-' + version._id} className="brutal-input block mt-1"><option value="summary">Summary</option>{['workExperience', 'projects'].flatMap((section) => (draft.value.content[section] || []).map((item, index) => <option key={section + index} value={section + ':' + index}>{section === 'projects' ? 'Project' : 'Experience'}: {item.title || item.role || index + 1}</option>))}</select></label>
      <button type="button" disabled={Boolean(working)} onClick={() => regenerate(document.getElementById('rewrite-' + version._id).value)} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">{working ? 'Rewriting selected section…' : 'Rewrite selected section'}</button>
      <p className="text-sm text-gray-600">A rewrite replaces only the selected section in your draft. Undo is available.</p>
    </div>
    <ResumeEditor content={draft.value.content} onChange={(content) => sync.change({ content, decisions: Object.fromEntries(changes.map((item) => [item.key, 'edited'])) })} />
    <AssessmentPanel resumeId={version.resumeId} versionId={version._id} record={version} disabled={draft.dirty || sync.saving} onAssessed={(assessment) => onSaved?.({ ...version, atsScore: assessment, assessmentMeta: assessment.assessmentMeta, atsScoreStale: false })} />
    <ExportPanel key={version._id} version={version} disabled={draft.dirty || sync.saving || draft.conflict} />
  </div>;
}
