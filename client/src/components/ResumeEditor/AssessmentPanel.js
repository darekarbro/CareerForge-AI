import React, { useState } from 'react';
import Link from 'next/link';
import { submitProcessingRequest } from '../../services/processing';
const criteria = { structureScore: 'Sections and evidence', keywordScore: 'Skill wording', formattingScore: 'Readability', lengthScore: 'Detail and length' };
export default function AssessmentPanel({ resumeId, versionId, record, onAssessed, disabled }) {
  const [working, setWorking] = useState(false), [error, setError] = useState('');
  const score = record?.atsScore, meta = record?.assessmentMeta;
  const run = async () => {
    setWorking(true); setError('');
    try { const response = await submitProcessingRequest('/resumes/' + resumeId + '/assess', { versionId }); onAssessed(response.data.data.assessment); }
    catch (failure) { setError(failure.response?.data?.message || failure.message || 'Unable to assess this resume'); }
    finally { setWorking(false); }
  };
  return <section className="brutal-card p-5 space-y-4" aria-label="Resume quality assessment">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Resume quality estimate</h2><p className="text-sm text-gray-600">Checks the saved resume’s structure, skill wording, readability and detail. Job match is measured separately in a job workspace.</p></div><strong className="text-3xl">{meta && score ? score.score + '%' : '—'}</strong></div>
    {record?.atsScoreStale && <p role="status" className="text-sm bg-amber-50 p-3">This estimate predates your latest edits. Run the assessment again after saving.</p>}
    {meta && <><dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Object.entries(criteria).map(([key, label]) => <div className="border-2 p-3" key={key}><dt className="text-sm">{label}</dt><dd className="font-bold text-xl">{score?.[key] ?? '—'}%</dd></div>)}</dl><p className="text-sm text-gray-600">{new Date(meta.assessedAt).toLocaleString()} · {meta.provider === 'deterministic-fallback' ? 'Offline rules' : 'AI-assisted assessment'} · Rubric {meta.rubricVersion}. Repeating the same saved input and model reuses this assessment.</p></>}
    <p className="text-sm">This is a writing aid, not a hiring prediction or a result from an employer’s tracking system.</p>
    {!!score?.improvements?.length && <div><h3 className="font-semibold">Next improvements</h3><ul className="list-disc pl-5 space-y-2 text-sm">{score.improvements.slice(0, 3).map((item, index) => <li key={index}>{item} <Link className="underline text-blue-700" href={'/resume/' + resumeId + '/edit?section=' + (/skill/i.test(item) ? 'skills' : /summary/i.test(item) ? 'summary' : /project/i.test(item) ? 'projects' : 'workExperience')}>Edit this section</Link></li>)}</ul></div>}
    <button type="button" disabled={disabled || working} onClick={run} className="brutal-btn-primary px-4 py-2 text-sm disabled:opacity-40">{working ? 'Assessing saved content…' : 'Assess saved resume'}</button>{error && <p role="alert" className="text-sm">{error}</p>}
  </section>;
}
