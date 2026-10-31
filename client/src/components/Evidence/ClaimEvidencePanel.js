import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Feedback } from '../Forms/Field';
const labels = { withheld: 'Withheld from the generated draft', needs_verification: 'Needs factual verification', needs_confirmation: 'Source needs your confirmation', source_consistent: 'Source checks passed — review wording', confirmed_fact: 'Confirmed source fact' };
export default function ClaimEvidencePanel({ version }) {
  const owner = useAuthStore((state) => state.user?.id), current = () => owner === useAuthStore.getState().user?.id;
  const [open, setOpen] = useState(false), [report, setReport] = useState(null), [error, setError] = useState(''), [working, setWorking] = useState(false), [refresh, setRefresh] = useState(0);
  const url = '/resumes/' + version.resumeId + '/versions/' + version._id + '/evidence';
  const identity = owner + ':' + url, latest = useRef(identity), collecting = useRef(null); latest.current = identity;
  useEffect(() => () => collecting.current?.abort(), [identity]);
  useEffect(() => {
    if (!open) return; const controller = new AbortController(); setWorking(true); setError(''); setReport(null);
    api.get(url, { signal: controller.signal }).then((res) => { if (!controller.signal.aborted) setReport(res.data.data); }).catch((failure) => { if (!controller.signal.aborted) setError(failure.response?.data?.message || 'Unable to load supporting evidence. Retry below.'); }).finally(() => { if (!controller.signal.aborted) setWorking(false); });
    return () => controller.abort();
  }, [open, url, owner, version.contentRevision, refresh]);
  async function collect() {
    const controller = new AbortController(); collecting.current?.abort(); collecting.current = controller; setWorking(true); setError('');
    const valid = () => !controller.signal.aborted && current() && latest.current === identity;
    try { const res = await api.post(url, {}, { signal: controller.signal }); if (valid()) setReport(res.data.data); }
    catch (failure) { if (valid()) setError(failure.response?.data?.message || 'Unable to collect source evidence.'); }
    finally { if (valid()) setWorking(false); }
  }
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="brutal-card p-5"><summary className="font-bold cursor-pointer">Evidence behind this resume</summary><div className="space-y-4 mt-4"><p className="text-sm">Inspect the facts behind each achievement. Automated checks catch known unsupported quantities, technologies and responsibility claims; they cannot establish semantic truth or authorship. Manual edits can introduce claims that need new evidence.</p><Feedback error={error} loading={working ? 'Checking evidence and verification states…' : ''} /><button type="button" disabled={working} className="underline text-sm" onClick={() => setRefresh(refresh + 1)}>Recheck evidence</button>
    {report && <><p role="status" className="text-sm font-semibold">{report.summary.cited} of {report.summary.total} current statements have citations · {report.summary.needsReview} need confirmation or verification · {report.historical || 0} unsupported suggestions withheld during generation</p>{report.legacy && <div className="border-2 border-amber-800 bg-amber-50 text-amber-950 p-3 space-y-2"><p className="text-sm">This earlier version has no evidence snapshot yet. Collect source facts, then confirm them in your library.</p><button type="button" disabled={working} className="underline font-semibold text-sm" onClick={collect}>Collect source evidence for this version</button></div>}
      <div className="space-y-3">{report.claims.map((claim, index) => <details key={JSON.stringify(claim.path) + index} className={'border-2 p-3 ' + (['needs_confirmation', 'needs_verification', 'withheld'].includes(claim.status) ? 'border-amber-800 bg-amber-50 text-amber-950' : '')}><summary className="font-semibold text-sm cursor-pointer">{claim.label} · {labels[claim.status] || claim.status}</summary><div className="space-y-3 mt-3 text-sm"><p className="whitespace-pre-wrap">{claim.text || 'No source replacement was available.'}</p>{claim.withheldText && <div><strong>Unsupported suggestion, excluded from the generated draft</strong><p className="whitespace-pre-wrap">{claim.withheldText}</p></div>}<p>{claim.explanation}</p>{claim.issues.length > 0 && <ul className="list-disc pl-5">{claim.issues.map((issue, number) => <li key={number}>{issue}</li>)}</ul>}
      {claim.citations.length ? <ul className="space-y-3">{claim.citations.map((citation) => <li key={citation.evidenceId} className="border-l-4 pl-3 space-y-1"><Link href={'/evidence?evidence=' + citation.evidenceId} className="font-bold underline">{citation.title}</Link><blockquote className="whitespace-pre-wrap break-words">{citation.quote}</blockquote><p>{citation.verification === 'confirmed' ? 'Confirmed by you' : 'Unverified source'} · Evidence revision {citation.revision} · Measurement: {citation.measurement || 'unknown'}</p>{citation.measurementNotes && <p>Measurement notes: {citation.measurementNotes}</p>}{citation.source?.quote && citation.source.quote !== citation.quote && <details><summary className="cursor-pointer">Original source passage</summary><p className="whitespace-pre-wrap">{citation.source.quote}</p></details>}</li>)}</ul> : <p>No eligible source citation is available. Add or confirm a fact linked to this entry in the evidence library, then collect source evidence again.</p>}</div></details>)}</div><div className="flex flex-wrap gap-3"><Link className="underline text-blue-800 text-sm" href="/evidence">Open career evidence library</Link><button type="button" disabled={working} className="underline text-sm" onClick={collect}>Collect source evidence again</button></div></>}
  </div></details>;
}
