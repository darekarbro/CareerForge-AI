import React, { useEffect, useId, useRef, useState } from 'react';
import { displayValue, resolvePlan } from '../../services/resumeTools';
export default function ConflictResolver({ resolution, onResolve }) {
  const prefix = useId(), heading = useRef(), [choices, setChoices] = useState({});
  useEffect(() => { setChoices({}); heading.current?.focus(); }, [resolution]);
  const { plan } = resolution, complete = plan.conflicts.every((_item, index) => choices[index]);
  return <section className="border-2 border-blue-800 bg-white p-4 space-y-4" aria-labelledby={prefix}>
    <h2 id={prefix} ref={heading} tabIndex={-1} className="font-bold">Resolve changes field by field</h2><p className="text-sm">Changes to different fields are combined automatically. For each overlapping change, choose which value to keep. Your local draft stays available until you apply the resolved result.</p>
    {!plan.conflicts.length && <p role="status" className="text-sm">There are no overlapping field changes. Your edits can be combined with the latest saved version.</p>}
    {plan.conflicts.map((item, index) => <fieldset key={JSON.stringify(item.path)} className="border-2 p-3 space-y-3"><legend className="font-bold px-2 text-sm">{item.label}</legend><div className="grid sm:grid-cols-2 gap-4">{[['mine', 'Keep my change', item.mine], ['theirs', 'Use latest saved change', item.theirs]].map(([choice, label, value]) => <label key={choice} className="block text-sm space-y-2"><span><input type="radio" name={prefix + index} value={choice} checked={choices[index] === choice} onChange={() => setChoices({ ...choices, [index]: choice })} /> {label}</span><pre tabIndex={0} className="whitespace-pre-wrap break-words font-sans p-2 bg-gray-100 text-gray-900 max-h-48 overflow-auto">{item[choice + 'Label'] ?? displayValue(value)}</pre></label>)}</div></fieldset>)}
    <button type="button" disabled={!complete} onClick={() => onResolve(resolvePlan(plan, choices))} className="brutal-btn-primary conflict-apply-button px-4 py-2 text-sm">Use resolved draft</button>
  </section>;
}
