import React from 'react';

const categories = { required_skill: 'Required skills', preferred_skill: 'Preferred skills', experience: 'Experience expectations', constraint: 'Practical constraints' };
const statuses = { supported: 'Evidence found', missing: 'Evidence missing', uncertain: 'Needs clarification' };

export default function RequirementMatchPanel({ report }) {
  if (!report) return null;
  const matches = report.requirementMatches || [];
  return <section className="brutal-card p-5 space-y-4" aria-label="Job requirement assessment">
    <h2 className="text-xl font-bold">Job match: {report.matchScore}%</h2>
    <p className="text-sm">Estimated evidence coverage for this saved job description. Listed experience and skills are self-reported; this score does not predict hiring decisions.</p>
    {!matches.length ? <><p className="text-sm">Run Check job match again to see the evidence for each requirement.</p><ul className="text-sm space-y-2">{(report.mustHaveMissing || []).map((item, index) => <li key={index}><strong>{item.skill}</strong>: {item.recommendation}</li>)}</ul></> : Object.entries(categories).map(([category, label]) => {
      const items = matches.filter((item) => item.category === category);
      return items.length ? <div key={category} className="space-y-3"><h3 className="font-bold">{label}</h3><ul className="space-y-3">{items.map((item) => <li key={item.id} className="border-2 p-4 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{item.label}</strong><span className={item.status === 'supported' ? 'text-green-800' : 'text-amber-900'}>{statuses[item.status] || 'Needs clarification'}</span></div>
        <p><span className="font-semibold">Job description: </span>{item.sourceText}</p>
        <p>{item.explanation}</p>
        {!!item.supportingEvidence?.length && <div><p className="font-semibold">Supporting resume evidence</p><ul className="space-y-2 mt-1">{item.supportingEvidence.map((evidence, index) => <li key={index}><blockquote className="border-l-4 pl-3 whitespace-pre-wrap">{evidence.quote}</blockquote><p className="text-xs text-gray-600 mt-1">Source: {Array.isArray(evidence.path) ? evidence.path.join(' › ') : evidence.path}</p></li>)}</ul></div>}
        {item.missingEvidence && <p><span className="font-semibold">What to clarify: </span>{item.missingEvidence}</p>}
      </li>)}</ul></div> : null;
    })}
    {!!report.requirements?.unclassified?.length && <details className="text-sm"><summary>Unclassified description text</summary><p className="my-2">Review these statements manually; the parser could not confidently turn them into requirements.</p><ul className="list-disc pl-5">{report.requirements.unclassified.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.sourceText || item.label}</li>)}</ul></details>}
    {!!report.rubric?.limitations?.length && <details className="text-sm"><summary>Rubric and limitations</summary><p className="my-2">Rubric {report.rubric.version}</p><ul className="list-disc pl-5 space-y-1">{report.rubric.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>}
  </section>;
}
