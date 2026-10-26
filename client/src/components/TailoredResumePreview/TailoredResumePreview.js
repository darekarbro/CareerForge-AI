import React from 'react';

function WebLink({ value }) {
  if (!value) return null;
  return /^https?:\/\//i.test(value)
    ? <a href={value} target="_blank" rel="noopener noreferrer" className="underline break-all">{value}</a>
    : <span className="break-all">{value}</span>;
}

function Section({ title, children }) {
  return <section className="space-y-3">
    <h3 className="font-headline font-bold text-sm uppercase tracking-wide border-b border-gray-300 pb-2">{title}</h3>
    {children}
  </section>;
}

export default function TailoredResumePreview({ content = {} }) {
  const contact = content.contactInfo || {};
  const used = new Set();
  const groups = [
    ['Technical skills', content.skills?.technical], ['Frameworks', content.skills?.frameworks],
    ['Tools & platforms', content.skills?.tools], ['Collaboration', content.skills?.soft],
    ['Additional skills', content.skills?.all],
  ].map(([label, values]) => ({ label, values: (values || []).filter((value) => {
    if (typeof value !== 'string') return false;
    const key = value.trim().toLowerCase();
    if (!key || used.has(key)) return false;
    used.add(key); return true;
  }) })).filter((group) => group.values.length);
  const dateRange = (entry) => [entry.startDate, entry.endDate || (entry.current ? 'Present' : '')].filter(Boolean).join(' – ');
  const bullets = (values) => values?.length ? <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
    {values.map((text, index) => <li key={index}>{text}</li>)}
  </ul> : null;
  return <article aria-label="Complete tailored resume" className="brutal-card p-6 sm:p-9 bg-white space-y-7 text-[#1a1a1a]">
    <header className="space-y-3 border-b-2 border-[#1a1a1a] pb-5">
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Complete tailored resume</p>
      {contact.name && <h2 className="font-headline text-2xl sm:text-3xl font-bold">{contact.name}</h2>}
      <p className="text-sm leading-relaxed break-words">{[contact.email, contact.phone, contact.location].filter(Boolean).join(' · ')}</p>
      {[contact.linkedin, contact.github, contact.portfolio].filter(Boolean).length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {[contact.linkedin, contact.github, contact.portfolio].filter(Boolean).map((value, index) => <WebLink key={index} value={value} />)}
      </div>}
    </header>
    {content.summary && <Section title="Professional summary"><p className="text-sm leading-relaxed whitespace-pre-line">{content.summary}</p></Section>}
    {groups.length > 0 && <Section title="Skills"><dl className="space-y-2 text-sm leading-relaxed">
      {groups.map((group) => <div key={group.label}><dt className="inline font-bold">{group.label}: </dt><dd className="inline">{group.values.join(', ')}</dd></div>)}
    </dl></Section>}
    {content.workExperience?.length > 0 && <Section title="Professional experience"><div className="space-y-6">
      {content.workExperience.map((entry, index) => <div key={index} className="space-y-2">
        <h4 className="font-bold text-sm">{[entry.role, entry.company].filter(Boolean).join(' | ')}</h4>
        <p className="text-xs text-gray-600">{[dateRange(entry), entry.location].filter(Boolean).join(' · ')}</p>
        {bullets(entry.highlights)}
      </div>)}
    </div></Section>}
    {content.projects?.length > 0 && <Section title="Selected projects"><div className="space-y-6">
      {content.projects.map((project, index) => <div key={index} className="space-y-2">
        <h4 className="font-bold text-sm">{project.title}</h4>
        {project.description && <p className="text-sm leading-relaxed whitespace-pre-line">{project.description}</p>}
        {project.technologies?.length > 0 && <p className="text-xs leading-relaxed"><span className="font-bold">Technologies: </span>{project.technologies.join(', ')}</p>}
        {project.link && <p className="text-xs"><WebLink value={project.link} /></p>}
        {bullets(project.highlights)}
      </div>)}
    </div></Section>}
    {content.education?.length > 0 && <Section title="Education"><div className="space-y-4">
      {content.education.map((entry, index) => <div key={index} className="space-y-1 text-sm">
        <h4 className="font-bold">{[entry.degree, entry.fieldOfStudy].filter(Boolean).join(' · ')}</h4>
        <p>{[entry.institution, entry.graduationYear].filter(Boolean).join(' · ')}</p>
        {entry.score && <p className="text-xs text-gray-600">{entry.score}</p>}
      </div>)}
    </div></Section>}
    {content.certifications?.length > 0 && <Section title="Certifications"><ul className="space-y-2 text-sm leading-relaxed">
      {content.certifications.map((entry, index) => <li key={index}><span className="font-bold">{entry.name}</span>{[entry.issuer, entry.year].filter(Boolean).length > 0 && ' · ' + [entry.issuer, entry.year].filter(Boolean).join(' · ')}</li>)}
    </ul></Section>}
  </article>;
}
