import React, { useState } from 'react';
import { Field, Feedback } from '../Forms/Field';
import { copy, newEntryId } from '../../services/resumeTools';
const prompts = {
  student: ['Coursework, volunteering and projects count. Describe your own contribution, including team projects.', 'What problem or assignment did the team need to solve?', 'What did you personally build, investigate or test?'],
  changer: ['Use transferable experience from your previous field. Keep job titles and outcomes accurate.', 'Which responsibility connects to the role you are moving toward?', 'What did you personally change, improve or deliver?'],
  professional: ['Use a specific responsibility or project. Separate your work from the team’s overall results.', 'What were you responsible for, and at what scope?', 'What did you personally implement, decide or lead?'],
};
export default function GuidedQuestions({ content, level, onChange, disabled }) {
  const [type, setType] = useState(level === 'student' ? 'projects' : 'workExperience'), [selected, setSelected] = useState('new'), [name, setName] = useState(''), [company, setCompany] = useState('');
  const [responsibility, setResponsibility] = useState(''), [contribution, setContribution] = useState(''), [tools, setTools] = useState(''), [outcome, setOutcome] = useState(''), [message, setMessage] = useState('');
  const prompt = prompts[level] || prompts.professional;
  function apply(event) {
    event.preventDefault(); const next = copy(content), entries = next[type], index = selected === 'new' ? entries.length : entries.findIndex((entry) => entry.entryId === selected);
    if (index < 0) { setMessage('The selected entry changed. Choose it again.'); return; }
    const technologies = tools.split(',').map((item) => item.trim()).filter(Boolean), highlights = [responsibility.trim(), contribution.trim(), outcome.trim()].filter(Boolean);
    if (selected === 'new') entries.push(type === 'projects' ? { entryId: newEntryId(), title: name.trim(), description: responsibility.trim(), technologies: [], link: '', highlights: [] } : { entryId: newEntryId(), role: name.trim(), company: company.trim(), location: '', startDate: '', endDate: '', current: false, highlights: [] });
    entries[index].highlights = [...new Set([...(entries[index].highlights || []), ...highlights])];
    if (type === 'projects') entries[index].technologies = [...new Set([...(entries[index].technologies || []), ...technologies])];
    else next.skills.tools = [...new Set([...(next.skills.tools || []), ...technologies])];
    next.skills.all = [...new Set(['technical', 'frameworks', 'tools', 'soft'].flatMap((key) => next.skills[key] || []))];
    onChange(next); setResponsibility(''); setContribution(''); setTools(''); setOutcome(''); setName(''); setCompany(''); setSelected(entries[index].entryId); setMessage('Your details were added to the draft. Review the entry and save when it is accurate.');
  }
  return <details className="brutal-card p-5"><summary className="font-bold cursor-pointer">Build stronger experience with guided questions</summary><form onSubmit={apply} className="space-y-4 mt-4"><p className="text-sm">{prompt[0]} Leave unknown outcomes blank. No numbers or results are generated for you.</p><fieldset disabled={disabled} className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Type of experience"><select className="brutal-input w-full" value={type} onChange={(event) => { setType(event.target.value); setSelected('new'); }}><option value="projects">Project</option><option value="workExperience">Work experience</option></select></Field><Field label="Add details to"><select className="brutal-input w-full" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="new">Create a new entry</option>{(content[type] || []).map((entry) => <option key={entry.entryId} value={entry.entryId}>{entry.title || [entry.role, entry.company].filter(Boolean).join(' at ') || 'Untitled entry'}</option>)}</select></Field></div>
    {selected === 'new' && <><Field label={type === 'projects' ? 'Guided project name' : 'Guided role title'}><input required maxLength={300} value={name} onChange={(event) => setName(event.target.value)} className="brutal-input w-full" /></Field>{type === 'workExperience' && <Field label="Guided employer"><input required maxLength={300} value={company} onChange={(event) => setCompany(event.target.value)} className="brutal-input w-full" /></Field>}</>}
    <Field label={prompt[1]}><textarea rows={3} maxLength={1500} value={responsibility} onChange={(event) => setResponsibility(event.target.value)} className="brutal-input w-full" /></Field>
    <Field label={prompt[2]}><textarea required rows={3} maxLength={1500} value={contribution} onChange={(event) => setContribution(event.target.value)} className="brutal-input w-full" /></Field>
    <Field label="Which tools or methods did you actually use?" hint="Separate tools with commas."><input maxLength={2000} value={tools} onChange={(event) => setTools(event.target.value)} className="brutal-input w-full" /></Field>
    <Field label="What outcome can you verify? (optional)" hint="A qualitative result is useful. Include a measurement only if you know how it was measured."><textarea rows={3} maxLength={1500} value={outcome} onChange={(event) => setOutcome(event.target.value)} className="brutal-input w-full" /></Field>
    <button className="brutal-btn-primary px-4 py-2 text-sm">Add my verified details to draft</button></fieldset><Feedback message={message} /></form></details>;
}
