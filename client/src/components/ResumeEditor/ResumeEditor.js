import React, { useId, useState } from 'react';
import TailoredResumePreview from '../TailoredResumePreview/TailoredResumePreview';
import { entryId, newEntryId, duplicateEntries, dateIssue, defaultPresentation } from '../../services/resumeTools';
import StructureControls from './StructureControls';
export const emptyContent = () => ({ contactInfo: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
  summary: '', skills: { technical: [], frameworks: [], tools: [], soft: [], all: [] }, workExperience: [], projects: [], education: [], certifications: [] });
export function normalizeContent(value = {}) {
  const base = emptyContent();
  const copy = JSON.parse(JSON.stringify(value));
  for (const key of Object.keys(base)) if (copy[key] !== undefined) base[key] = copy[key];
  base.contactInfo = { ...emptyContent().contactInfo, ...base.contactInfo };
  base.skills = { ...emptyContent().skills, ...base.skills };
  const known = new Set(['technical', 'frameworks', 'tools', 'soft'].flatMap((key) => base.skills[key] || []).map((skill) => skill.toLowerCase()));
  base.skills.technical = [...base.skills.technical, ...base.skills.all.filter((skill) => !known.has(skill.toLowerCase()))];
  for (const key of ['workExperience', 'projects', 'education', 'certifications']) base[key] = (base[key] || []).map((entry, index) => ({ ...entry, entryId: entryId(entry, key, index), ...(key === 'workExperience' && entry.current && /^(present|current|now)$/i.test(entry.endDate || '') ? { endDate: '' } : {}) }));
  return base;
}
const sections = [['contactInfo', 'Contact'], ['summary', 'Summary'], ['skills', 'Skills'], ['workExperience', 'Experience'], ['projects', 'Projects'], ['education', 'Education'], ['certifications', 'Certificates']];
const definitions = {
  workExperience: { label: 'Experience', fields: [['role', 'Role'], ['company', 'Employer'], ['location', 'Location'], ['startDate', 'Start date'], ['endDate', 'End date']],
    initial: { role: '', company: '', location: '', startDate: '', endDate: '', current: false, highlights: [] } },
  projects: { label: 'Project', fields: [['title', 'Project name'], ['link', 'Project URL']],
    initial: { title: '', link: '', description: '', technologies: [], highlights: [] } },
  education: { label: 'Education', fields: [['degree', 'Degree'], ['institution', 'Institution'], ['fieldOfStudy', 'Field of study'], ['graduationYear', 'Graduation year'], ['score', 'Grade or score']],
    initial: { degree: '', institution: '', fieldOfStudy: '', graduationYear: '', score: '' } },
  certifications: { label: 'Certificate', fields: [['name', 'Certificate name'], ['issuer', 'Issuer'], ['year', 'Year']], initial: { name: '', issuer: '', year: '' } },
};
export default function ResumeEditor({ content, onChange, disabled = false, initialSection = 'contactInfo', presentation, onPresentationChange, issues = [] }) {
  const prefix = useId(), [section, setSection] = useState(initialSection), [preview, setPreview] = useState(false);
  const duplicates = duplicateEntries(content), order = presentation?.sectionOrder || defaultPresentation().sectionOrder;
  const update = (keys, value) => {
    const next = JSON.parse(JSON.stringify(content));
    let current = next;
    keys.slice(0, -1).forEach((key) => { current = current[key]; });
    current[keys.at(-1)] = value;
    if (keys[0] === 'skills') next.skills.all = [...new Set(['technical', 'frameworks', 'tools', 'soft'].flatMap((key) => next.skills[key] || []))];
    onChange(next);
  };
  const field = (keys, label, options = {}) => {
    const id = prefix + keys.join('-');
    const value = keys.reduce((current, key) => current?.[key], content) ?? '';
    const display = options.lines ? value.join('\n') : options.list ? value.join(', ') : value;
    const edit = (event) => update(keys, options.lines ? event.target.value.split('\n') : options.list ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean) : event.target.value);
    const dateError = keys[0] === 'workExperience' && ['startDate', 'endDate'].includes(keys[2]) ? dateIssue(content.workExperience[keys[1]]) : '';
    const uncertain = issues.find((issue) => JSON.stringify(issue.path) === JSON.stringify(keys));
    const note = dateError || uncertain?.reason || options.help;
    const inputProps = { 'aria-invalid': dateError ? true : undefined, 'aria-describedby': note ? id + '-help' : undefined };
    return <div key={id} className={options.wide ? 'md:col-span-2' : ''}>
      <label htmlFor={id} className="block text-sm font-semibold mb-1">{label}</label>
      {options.area ? <textarea {...inputProps} id={id} value={display} onChange={edit} disabled={disabled} rows={options.rows || 5} maxLength={options.maxLength || 6000} className="brutal-input w-full text-sm leading-relaxed" /> :
        <input {...inputProps} id={id} type={options.type || 'text'} value={display} onChange={edit} disabled={disabled || (keys[0] === 'workExperience' && keys[2] === 'endDate' && content.workExperience[keys[1]].current)} maxLength={options.maxLength || 2048} className={'brutal-input w-full text-sm ' + (uncertain ? 'bg-amber-50 border-amber-800' : '')} />}
      {note && <p id={id + '-help'} className={'text-sm mt-1 ' + (dateError ? 'text-red-800' : uncertain ? 'text-amber-900' : 'text-gray-600')}>{note}</p>}
    </div>;
  };
  return <div className="space-y-5">
    {onPresentationChange && <StructureControls value={presentation} onChange={onPresentationChange} disabled={disabled} />}
    {duplicates.length > 0 && <aside role="status" className="border-2 border-amber-800 bg-amber-50 text-amber-950 p-4 text-sm"><h2 className="font-bold">Possible duplicate entries</h2><ul className="list-disc pl-5">{duplicates.map((item) => <li key={item.section + item.index}>{item.message}</li>)}</ul></aside>}
    <div className="flex flex-wrap justify-between gap-3">
      <div role="group" aria-label="Resume sections" className="flex flex-wrap gap-2">
        {[sections[0], ...order.map((key) => sections.find(([id]) => id === key))].map(([key, label]) => <button type="button" key={key} aria-pressed={!preview && section === key}
          onClick={() => { setSection(key); setPreview(false); }} className={'px-3 py-2 border-2 border-[#1a1a1a] text-sm font-semibold ' + (!preview && section === key ? 'bg-[#ffcc00]' : 'bg-white')}>{label}</button>)}
      </div>
      <button type="button" onClick={() => setPreview(!preview)} className="brutal-btn-blue px-4 py-2 text-sm">{preview ? 'Back to editing' : 'Preview resume'}</button>
    </div>
    {preview ? <TailoredResumePreview content={content} presentation={presentation} /> : <div className="brutal-card p-5 sm:p-6 space-y-5" id={'resume-' + section}>
      <h2 className="text-lg font-bold">{sections.find(([key]) => key === section)?.[1]}</h2>
      {section === 'contactInfo' && <div className="grid md:grid-cols-2 gap-4">
        {field(['contactInfo', 'name'], 'Full name')}{field(['contactInfo', 'email'], 'Contact email', { type: 'email' })}
        {field(['contactInfo', 'phone'], 'Phone')}{field(['contactInfo', 'location'], 'Location')}
        {field(['contactInfo', 'linkedin'], 'LinkedIn URL')}{field(['contactInfo', 'github'], 'GitHub URL')}{field(['contactInfo', 'portfolio'], 'Portfolio URL')}
      </div>}
      {section === 'summary' && field(['summary'], 'Professional summary', { area: true, rows: 7, help: 'Describe your actual experience, the work you do and relevant strengths.' })}
      {section === 'skills' && <div className="grid md:grid-cols-2 gap-4">
        {field(['skills', 'technical'], 'Technical skills', { list: true, help: 'Separate skills with commas.' })}
        {field(['skills', 'frameworks'], 'Frameworks', { list: true })}{field(['skills', 'tools'], 'Tools and platforms', { list: true })}
        {field(['skills', 'soft'], 'Collaboration and other skills', { list: true })}
      </div>}
      {definitions[section] && <>
        {(content[section] || []).map((entry, index) => <fieldset key={entry.entryId || entry._id || index} className="border-2 border-gray-300 p-4 space-y-4">
          <legend className="px-2 text-sm font-bold">{definitions[section].label} {index + 1}</legend>
          <div className="grid md:grid-cols-2 gap-4">{definitions[section].fields.map(([key, label]) => field([section, index, key], label + ' ' + (index + 1)))}</div>
          {section === 'workExperience' && <><p className="text-sm text-gray-600">Dates accept YYYY, YYYY-MM or Month YYYY.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(entry.current)} disabled={disabled} onChange={(event) => { const entries = [...content.workExperience]; entries[index] = { ...entry, current: event.target.checked, ...(event.target.checked ? { endDate: '' } : {}) }; update(['workExperience'], entries); }} />I currently work here</label></>}
          {section === 'projects' && <>
            {field([section, index, 'description'], 'Project purpose and your contribution ' + (index + 1), { area: true, rows: 4, maxLength: 4000 })}
            {field([section, index, 'technologies'], 'Project technologies ' + (index + 1), { list: true })}
          </>}
          {['workExperience', 'projects'].includes(section) && field([section, index, 'highlights'], 'Achievements ' + (index + 1), { area: true, lines: true, rows: 6, maxLength: 48000,
            help: 'Use one bullet per line. Include what you personally did, tools or decisions, scope, and results you can verify.' })}
          <div className="flex flex-wrap gap-3">{[-1, 1].map((offset) => <button type="button" key={offset} disabled={disabled || index + offset < 0 || index + offset >= content[section].length} className="border-2 p-2 text-sm disabled:opacity-40" aria-label={(offset < 0 ? 'Move entry up: ' : 'Move entry down: ') + definitions[section].label.toLowerCase() + ' ' + (index + 1)} onClick={() => { const entries = [...content[section]]; [entries[index], entries[index + offset]] = [entries[index + offset], entries[index]]; update([section], entries); }}>{offset < 0 ? 'Move entry up' : 'Move entry down'}</button>)}</div>
          <button type="button" disabled={disabled} onClick={() => update([section], content[section].filter((_item, itemIndex) => itemIndex !== index))} className="text-sm font-semibold underline text-red-800">Remove {definitions[section].label.toLowerCase()} {index + 1}</button>
        </fieldset>)}
        <button type="button" disabled={disabled} onClick={() => update([section], [...(content[section] || []), { ...JSON.parse(JSON.stringify(definitions[section].initial)), entryId: newEntryId() }])} className="brutal-btn-primary px-4 py-2 text-sm">Add {definitions[section].label.toLowerCase()}</button>
      </>}
    </div>}
  </div>;
}
