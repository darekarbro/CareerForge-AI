import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { normalizeContent } from './ResumeEditor';
import SourceComparison from './SourceComparison';
import { importUnits, mergeImport } from '../../services/importMerge';
import { Feedback } from '../Forms/Field';
const display = (value) => value === undefined || value === '' ? 'Empty' : Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value, (key, item) => ['_id', 'entryId'].includes(key) ? undefined : item, 2) : value;
export default function ImportMerge({ resumeId, content, onApply, onClose, disabled }) {
  const [review, setReview] = useState(null), [selected, setSelected] = useState([]), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setReview(null); setSelected([]); setError('');
    api.get('/resumes/' + resumeId + '/import-review', { signal: controller.signal }).then((res) => { if (!controller.signal.aborted) setReview({ ...res.data.data, content: normalizeContent(res.data.data.content) }); }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to compare this import. Close it and try again.'); });
    return () => controller.abort();
  }, [resumeId]);
  const units = useMemo(() => review ? importUnits(content, review) : [], [content, review]);
  if (!review) return <div><Feedback error={error} loading={!error ? 'Loading the source and extracted fields…' : ''} /><button type="button" onClick={onClose} className="underline">Close import review</button></div>;
  return <div className="space-y-4"><SourceComparison review={review}><h3 className="font-bold">Choose exactly what to import</h3><p className="text-sm">Unselected fields stay unchanged. Selected skills are added to existing groups; selected entry fields replace only that field. No changes are made until you apply them.</p><p role="status" className="text-sm font-semibold">{selected.filter((key) => units.some((unit) => unit.key === key)).length} fields selected</p>
    <div className="flex gap-3 flex-wrap"><button type="button" disabled={disabled} className="underline text-sm" onClick={() => setSelected(units.map((unit) => unit.key))}>Select all incoming fields</button><button type="button" disabled={disabled} className="underline text-sm" onClick={() => setSelected([])}>Clear selection</button></div>
    {!units.length && <p className="text-sm">These facts are already in your profile. Nothing needs to be replaced.</p>}
    <div className="space-y-4 max-h-[650px] overflow-auto">{units.map((unit) => <div key={unit.key} className={'border-2 p-3 space-y-3 ' + (unit.uncertain ? 'border-amber-800 bg-amber-50 text-amber-950' : '')}><label className="font-bold text-sm flex gap-2 items-start"><input type="checkbox" disabled={disabled} checked={selected.includes(unit.key)} onChange={(event) => setSelected(event.target.checked ? [...selected, unit.key] : selected.filter((key) => key !== unit.key))} />{unit.label}</label>{unit.uncertain && <p className="text-sm">Check this against the source before importing.</p>}<div className="grid sm:grid-cols-2 gap-3 text-sm"><div><strong>Current profile</strong><pre className="font-sans whitespace-pre-wrap break-words">{display(unit.before)}</pre></div><div><strong>Incoming</strong><pre className="font-sans whitespace-pre-wrap break-words">{display(unit.after)}</pre></div></div></div>)}</div>
  </SourceComparison><div className="flex gap-3 flex-wrap"><button type="button" disabled={disabled || !selected.length} onClick={() => onApply(mergeImport(content, units, selected), review.title)} className="brutal-btn-primary px-4 py-2 disabled:opacity-40">Apply selected facts to profile draft</button><button type="button" onClick={onClose} className="border-2 px-4 py-2">Close import review</button></div></div>;
}
