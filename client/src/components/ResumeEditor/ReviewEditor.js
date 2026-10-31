import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ResumeEditor, { normalizeContent } from './ResumeEditor';
import DraftToolbar from '../DraftToolbar/DraftToolbar';
import AssessmentPanel from './AssessmentPanel';
import ExportPanel from './ExportPanel';
import RevisionHistory from './RevisionHistory';
import ClaimEvidencePanel from '../Evidence/ClaimEvidencePanel';
import usePersistentDraft from '../../hooks/usePersistentDraft';
import useDraftSync from '../../hooks/useDraftSync';
import { useAuthStore } from '../../store/authStore';
import { submitProcessingRequest } from '../../services/processing';
import { defaultPresentation, copy } from '../../services/resumeTools';
import api from '../../services/api';
export function reviewChanges(version) {
  if (version.reviewChanges) return version.reviewChanges;
  const source = normalizeContent(version.sourceContent || {}), target = normalizeContent(version.tailoredContent || {}), changes = [];
  const add = (label, before, after, path, key) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const detail = version.diffFromOriginal?.modifiedHighlights?.find((item) => item.original === before && item.tailored === after);
    changes.push({ key, label, before, after, path, reason: detail?.reason || (path[0] === 'skills' ? 'Prioritizes verified skills for this role.' : 'Clarifies your existing contribution for ' + version.targetRole + '. Verify the wording against your source facts.') });
  };
  add('Professional summary', source.summary, target.summary, ['summary'], 'summary');
  for (const section of ['workExperience', 'projects']) target[section].forEach((item, index) => {
    const original = source[section].find((entry) => entry.entryId === item.entryId) || source[section][index] || {}, label = item.title || [item.role, item.company].filter(Boolean).join(' at ') || section, key = 'r_' + section + '_' + item.entryId;
    if (section === 'projects') add(label + ' — description', original.description || '', item.description || '', [section, index, 'description'], key + '_description');
    const before = original.highlights || [], after = item.highlights || [];
    if (JSON.stringify([...before].sort()) === JSON.stringify([...after].sort())) add(label + ' — bullet order', before, after, [section, index, 'highlights'], key + '_order');
    else after.forEach((text, line) => add(label + ' — achievement ' + (line + 1), before[line] || '', text, [section, index, 'highlights', line], key + '_bullet_' + line));
  });
  for (const group of ['technical', 'frameworks', 'tools', 'soft']) add(group + ' skills', source.skills[group], target.skills[group], ['skills', group], 'r_skills_' + group);
  return changes;
}
const decode = (version) => {
  const previous = version.reviewDecisions || {}, decisions = { ...previous };
  reviewChanges(version).forEach((item, index) => { if (!decisions[item.key] && previous[String(index)]) decisions[item.key] = previous[String(index)]; });
  const content = normalizeContent(version.reviewedContent || version.tailoredContent), target = normalizeContent(version.tailoredContent);
  if (version.reviewedContent) for (const section of ['workExperience', 'projects', 'education', 'certifications']) content[section].forEach((entry, index) => { if (!version.reviewedContent[section]?.[index]?.entryId && target[section][index]) entry.entryId = target[section][index].entryId; });
  return { revision: version.contentRevision || 1, value: { content, decisions, revisionName: version.revisionName || 'Reviewed version', presentation: version.presentation || defaultPresentation() } };
};
export default function ReviewEditor({ version, onSaved }) {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id), prefix = useId();
  const [server, setServer] = useState(() => ({ ...decode(version), userId })), [working, setWorking] = useState('');
  const { query } = useRouter(), [suggestion, setSuggestion] = useState(null);
  const draft = usePersistentDraft('version:' + version._id, server), latest = useRef(draft.value); latest.current = draft.value;
  const url = '/resumes/' + version.resumeId + '/versions/' + version._id;
  const sync = useDraftSync(draft, url, decode, (saved, record) => { setServer(saved); onSaved?.(record); });
  const changes = useMemo(() => reviewChanges(version), [version]);
  function pathFor(item, content) {
    const path = [...item.path];
    if (['workExperience', 'projects'].includes(path[0])) {
      const original = normalizeContent(version.tailoredContent)[path[0]][path[1]];
      const index = content[path[0]].findIndex((entry) => entry.entryId === original?.entryId);
      if (index < 0) return null; path[1] = index;
    }
    return path;
  }
  const at = (content, path) => path?.reduce((value, key) => value?.[key], content);
  function editContent(content) {
    const decisions = { ...latest.current.decisions };
    for (const item of changes) if (JSON.stringify(at(content, pathFor(item, content))) !== JSON.stringify(at(latest.current.content, pathFor(item, latest.current.content)))) decisions[item.key] = 'edited';
    sync.change({ ...latest.current, content, decisions });
  }
  const decide = (item, decision) => {
    const content = copy(draft.value.content), path = pathFor(item, content);
    if (!path) { sync.setError('This entry was removed from the draft. Undo that removal before applying its suggestion.'); return; }
    let parent = content; path.slice(0, -1).forEach((key) => { parent = parent[key]; }); parent[path.at(-1)] = copy(decision === 'rejected' ? item.before : item.after);
    if (path[0] === 'skills') content.skills.all = [...new Set(['technical', 'frameworks', 'tools', 'soft'].flatMap((key) => content.skills[key]))];
    sync.change({ ...draft.value, content, decisions: { ...draft.value.decisions, [item.key]: decision } });
  };
  function applySuggestion(result) {
    const content = copy(latest.current.content);
    if (result.section === 'summary') content.summary = result.value;
    else { const source = normalizeContent(version.tailoredContent)[result.section]?.[result.index]; const index = content[result.section]?.findIndex((entry) => entry.entryId === source?.entryId); if (index < 0) throw new Error('That entry was removed. Undo its removal before applying the rewrite.'); content[result.section][index] = { ...result.value, entryId: content[result.section][index].entryId }; }
    editContent(content);
  }
  const regenerate = async (selection) => {
    if (working) return;
    const [section, index] = selection.split(':'); setWorking(selection); sync.setError('');
    try { const response = await submitProcessingRequest(url + '/regenerate', { section, ...(index === undefined ? {} : { index: Number(index) }) }); if (sync.current()) applySuggestion(response.data.data); }
    catch (failure) { if (sync.current()) sync.setError(failure.response?.data?.message || failure.message || 'Unable to rewrite this section'); }
    finally { if (sync.current()) setWorking(''); }
  };
  useEffect(() => {
    if (!query.suggestion) return;
    const controller = new AbortController();
    api.get('/processing-jobs/' + query.suggestion, { signal: controller.signal }).then(({ data }) => { const job = data.data; if (!controller.signal.aborted && job.status === 'COMPLETED' && job.jobType === 'section_rewrite' && job.inputRef.versionId === version._id) setSuggestion(job.output); }).catch(() => {});
    return () => controller.abort();
  }, [query.suggestion, version._id]);
  if (!draft.ready) return <p role="status">Loading your review draft…</p>;
  const reviewed = changes.filter((item) => draft.value.decisions[item.key]).length, pending = changes.findIndex((item) => !draft.value.decisions[item.key]);
  return <div className="space-y-5">
    <DraftToolbar draft={draft} saving={sync.saving} error={sync.error} onSave={sync.save} onReload={sync.reload} onResolve={sync.prepareResolution} resolution={sync.resolution} onResolved={sync.resolve} />
    <label className="block font-semibold text-sm">Name this revision<input disabled={draft.conflict} className="brutal-input w-full block mt-1" maxLength={100} value={draft.value.revisionName} onChange={(event) => sync.change({ ...draft.value, revisionName: event.target.value })} /></label>
    {suggestion && <aside className="brutal-card p-4 space-y-3"><h2 className="font-bold">Recovered section suggestion</h2><p className="text-sm whitespace-pre-line">{typeof suggestion.value === 'string' ? suggestion.value : [suggestion.value.description, ...(suggestion.value.highlights || [])].filter(Boolean).join('\n')}</p><button type="button" className="border-2 px-3 py-2 text-sm" onClick={() => { try { applySuggestion(suggestion); setSuggestion(null); } catch (err) { sync.setError(err.message); } }}>Apply suggestion to draft</button></aside>}
    <p className="text-sm">Review suggestions and their reasons, then edit details below. Exports use saved edits. <Link className="underline text-blue-700" href={'/resume/' + version.resumeId + '/edit?source=1'}>Compare the source and add verified facts</Link></p>
    <section className="brutal-card p-4 space-y-2" aria-label="AI review progress"><h2 className="font-bold">{reviewed} of {changes.length} suggestions reviewed</h2><progress aria-label="AI suggestion review progress" value={changes.length ? reviewed : 1} max={changes.length || 1} className="w-full" /><p className="text-sm">Editing one field preserves decisions for other suggestions.</p></section>
    <details className="brutal-card p-5" open><summary className="font-semibold cursor-pointer">Review {changes.length} suggested changes</summary><div className="mt-3"><button type="button" disabled={pending < 0} className="underline text-sm disabled:opacity-40" onClick={() => document.getElementById(prefix + pending)?.focus()}>Next pending suggestion</button></div>
      <div className="space-y-4 mt-4">{changes.map((item, index) => <article key={item.key} id={prefix + index} tabIndex={-1} className="border-2 p-4 space-y-3"><h3 className="font-semibold">{item.label}</h3><div className="grid md:grid-cols-2 gap-4 text-sm leading-relaxed"><div><strong>Original</strong><p className="whitespace-pre-line">{Array.isArray(item.before) ? item.before.join('\n') : item.before || 'No original text'}</p></div><div><strong>Suggested</strong><p className="whitespace-pre-line">{Array.isArray(item.after) ? item.after.join('\n') : item.after}</p></div></div><p className="text-sm text-gray-600"><strong>Why this helps: </strong>{item.reason}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={draft.conflict} onClick={() => decide(item, 'accepted')} aria-pressed={draft.value.decisions[item.key] === 'accepted'} className="border-2 px-3 py-2 aria-pressed:bg-green-100">Accept</button><button type="button" disabled={draft.conflict} onClick={() => decide(item, 'rejected')} aria-pressed={draft.value.decisions[item.key] === 'rejected'} className="border-2 px-3 py-2 aria-pressed:bg-red-100">Keep original</button><span>{draft.value.decisions[item.key] || 'Pending review'}</span></div></article>)}</div>
    </details>
    <div className="brutal-card p-4 flex flex-wrap gap-3 items-end"><label className="text-sm font-semibold">Rewrite one section<select id={'rewrite-' + version._id} className="brutal-input block mt-1"><option value="summary">Summary</option>{['workExperience', 'projects'].flatMap((section) => normalizeContent(version.tailoredContent)[section].map((item, index) => <option key={section + item.entryId} value={section + ':' + index}>{section === 'projects' ? 'Project' : 'Experience'}: {item.title || item.role || index + 1}</option>))}</select></label><button type="button" disabled={Boolean(working) || draft.conflict} onClick={() => regenerate(document.getElementById('rewrite-' + version._id).value)} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">{working ? 'Rewriting selected section…' : 'Rewrite selected section'}</button><p className="text-sm text-gray-600">Only the selected section is replaced. Undo remains available.</p></div>
    <ResumeEditor content={draft.value.content} disabled={draft.conflict} presentation={draft.value.presentation} onPresentationChange={(presentation) => sync.change({ ...draft.value, presentation })} onChange={editContent} />
    <ClaimEvidencePanel version={version} />
    <RevisionHistory url={url + '/history'} restoreUrl={url + '/restore'} revision={draft.baseRevision} disabled={draft.dirty || sync.saving || draft.conflict} onRestored={(record) => { const saved = { ...decode(record), userId }; draft.markSaved(saved, draft.value); setServer(saved); onSaved?.(record); }} />
    <AssessmentPanel resumeId={version.resumeId} versionId={version._id} record={version} disabled={draft.dirty || sync.saving} onAssessed={(assessment) => onSaved?.({ ...version, atsScore: assessment, assessmentMeta: assessment.assessmentMeta, atsScoreStale: false })} />
    <ExportPanel key={version._id} version={version} disabled={draft.dirty || sync.saving || draft.conflict} />
  </div>;
}
