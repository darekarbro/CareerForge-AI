import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Feedback } from '../Forms/Field';
function extractedFields(value, path = []) {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value.length ? [{ path, value: value.join(', ') }] : [];
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => !['_id', 'entryId'].includes(key)).flatMap(([key, item]) => extractedFields(item, [...path, Array.isArray(value) ? Number(key) : key]));
  return value === '' || value === undefined || value === null ? [] : [{ path, value: String(value) }];
}
const label = (path) => path.map((part) => typeof part === 'number' ? part + 1 : part.replace(/([a-z])([A-Z])/g, '$1 $2')).join(' / ');
export default function SourceComparison({ review, children }) {
  const [sourceUrl, setSourceUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let url = ''; setSourceUrl(''); setError('');
    if (review.fileType === 'pdf' && review.originalAvailable) api.get('/resumes/' + review.resumeId + '/source-document', { responseType: 'blob', signal: controller.signal }).then((res) => {
      if (controller.signal.aborted) return; url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); setSourceUrl(url);
    }).catch(() => { if (!controller.signal.aborted) setError('The PDF preview could not load. The extracted source text is shown below.'); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [review.resumeId, review.fileType, review.originalAvailable]);
  return <section className="brutal-card p-4 space-y-4"><h2 className="text-xl font-bold">Compare extracted facts with the source</h2><p className="text-sm">Yellow flags mean text was not found verbatim, or a field is missing. They are review cues, not confidence scores. Confirm names, dates and contributions before using them.</p>
    <div className="grid lg:grid-cols-2 gap-5"><div className="min-w-0 space-y-3"><h3 className="font-bold">{review.sourceLabel}</h3><Feedback error={error} />{sourceUrl && <iframe title="Original resume document" className="w-full h-[550px] border-2" src={sourceUrl} />}<details open={!sourceUrl}><summary className="font-semibold cursor-pointer">Original extracted text</summary><pre tabIndex={0} aria-label="Original extracted text contents" className="font-sans whitespace-pre-wrap break-words text-sm leading-relaxed max-h-[600px] overflow-auto bg-gray-50 text-gray-900 border p-3 mt-2">{review.sourceText || 'No source text available.'}</pre></details></div>
    <div className="min-w-0 space-y-4">{children || <><h3 className="font-bold">Extracted fields</h3><dl tabIndex={0} aria-label="Extracted resume fields" className="space-y-3 max-h-[600px] overflow-auto">{extractedFields(review.content).map((field) => { const issue = review.issues.find((item) => JSON.stringify(item.path) === JSON.stringify(field.path)); return <div key={JSON.stringify(field.path)} className={'border p-3 text-sm ' + (issue ? 'bg-amber-50 text-amber-950 border-amber-800' : '')}><dt className="font-semibold">{label(field.path)}</dt><dd className="whitespace-pre-wrap break-words">{field.value}</dd>{issue && <dd className="mt-1">Review cue: {issue.reason}</dd>}</div>; })}</dl><h3 className="font-bold">Fields needing review ({review.issues.length})</h3>{review.issues.length ? <ul className="space-y-2">{review.issues.map((issue) => <li key={JSON.stringify(issue.path)} className="bg-amber-50 border border-amber-800 text-amber-950 p-3 text-sm"><strong>{issue.path.map((part) => typeof part === 'number' ? part + 1 : part.replace(/([a-z])([A-Z])/g, '$1 $2')).join(' / ')}</strong><p>{issue.reason}</p></li>)}</ul> : <p className="text-sm">No verbatim mismatches were detected. Still check accuracy and context before saving.</p>}</>}{review.warnings.map((warning, index) => <p key={index} className="text-sm text-amber-950">{warning}</p>)}</div></div>
  </section>;
}
