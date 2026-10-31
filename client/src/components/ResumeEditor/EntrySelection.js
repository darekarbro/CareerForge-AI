import React from 'react';
import { normalizeContent } from './ResumeEditor';
export default function EntrySelection({ resume, value, onChange, disabled }) {
  if (!resume) return <p className="text-sm">Choose a ready resume to select experience and projects for this job.</p>;
  const content = normalizeContent(resume.parsedData), choice = value || {};
  return <section className="brutal-card p-5 space-y-4"><h2 className="text-xl font-bold">Choose experience and projects for this job</h2><p className="text-sm">These choices affect tailoring, job matching and interview preparation in this workspace. Your source resume and career profile keep all entries.</p>
    {['workExperience', 'projects'].map((section) => {
      const entries = content[section], selected = choice[section] ?? entries.map((entry) => entry.entryId), stale = selected.some((id) => !entries.some((entry) => entry.entryId === id));
      return <fieldset key={section} disabled={disabled} className="border-2 p-4 space-y-3"><legend className="font-semibold px-2">{section === 'projects' ? 'Projects' : 'Experience'} · {selected.filter((id) => entries.some((entry) => entry.entryId === id)).length} of {entries.length} included</legend>
        {stale && <p role="alert" className="text-red-800 text-sm">Some selected entries changed or were removed. Reset this selection before continuing.</p>}
        {!entries.length && <p className="text-sm">No entries in this section.</p>}{entries.map((entry, index) => <label key={entry.entryId} className="flex gap-2 items-start text-sm"><input type="checkbox" checked={selected.includes(entry.entryId)} onChange={(event) => onChange({ ...choice, [section]: event.target.checked ? [...selected, entry.entryId] : selected.filter((id) => id !== entry.entryId) })} /><span>Include {entry.title || [entry.role, entry.company].filter(Boolean).join(' at ') || 'entry ' + (index + 1)}</span></label>)}
        <div className="flex gap-3 flex-wrap"><button type="button" onClick={() => onChange({ ...choice, [section]: null })} className="underline text-sm">Use all current {section === 'projects' ? 'projects' : 'experience'}</button><button type="button" onClick={() => onChange({ ...choice, [section]: [] })} className="underline text-sm">Exclude all {section === 'projects' ? 'projects' : 'experience'}</button></div>
      </fieldset>;
    })}
  </section>;
}
