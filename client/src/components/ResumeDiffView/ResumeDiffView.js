import React from 'react';
import Link from 'next/link';
import TailoredResumePreview from '../TailoredResumePreview/TailoredResumePreview';

export default function ResumeDiffView({ diff, originalResume, tailoredContent, targetRole, improvementSuggestions = [] }) {
  const original = originalResume?.parsedData || {};
  const content = { ...original, ...tailoredContent };
  content.contactInfo = { ...original.contactInfo, ...tailoredContent?.contactInfo };
  for (const section of ['education', 'certifications']) {
    if (!content[section]?.length) content[section] = original[section] || [];
  }
  const skillCount = new Set(Object.values(content.skills || {}).flat().filter((value) => typeof value === 'string')
    .map((value) => value.trim().toLowerCase()).filter(Boolean)).size;
  const changes = diff?.modifiedHighlights || [];
  return <div className="space-y-6">
    <div className="p-4 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-wider">Tailored for</p>
        <h3 className="font-headline font-black text-xl uppercase">{targetRole}</h3></div>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="px-3 py-2 border-2 border-[#1a1a1a] bg-white">{skillCount} skills retained</span>
        <span className="px-3 py-2 border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white">{changes.length} bullet changes</span>
      </div>
    </div>

    <TailoredResumePreview content={content} />

    {improvementSuggestions.length > 0 && <aside aria-label="Details to strengthen" className="brutal-card p-5 space-y-3 bg-[#f5f0e8]">
      <h3 className="font-headline font-bold uppercase text-sm">Details you can add to strengthen this resume</h3>
      <p className="text-xs leading-relaxed text-gray-600">Add these verified details to your source resume and upload it again to create a stronger version.</p>
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-2">
        {improvementSuggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}
      </ul>
      <Link href="/resume/upload" className="inline-block text-sm font-bold underline">Upload a more detailed source resume</Link>
    </aside>}

    <details className="brutal-card p-5 space-y-5">
      <summary className="cursor-pointer font-headline font-bold text-sm uppercase">Review before-and-after changes</summary>
      <section className="space-y-3">
        <h3 className="font-bold text-sm">Professional summary</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm leading-relaxed">
          <div className="border-2 border-[#1a1a1a] p-4 bg-[#f5f0e8]"><h4 className="font-bold mb-2">Before</h4>
            <p>{diff?.summaryDiff?.original || original.summary || 'No original summary provided.'}</p></div>
          <div className="border-2 border-[#1a1a1a] p-4 bg-[#d6e3ff]"><h4 className="font-bold mb-2">After</h4>
            <p>{diff?.summaryDiff?.tailored || content.summary}</p></div>
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="font-bold text-sm">Experience and project bullets</h3>
        {!changes.length && <p className="text-sm text-gray-600">The original evidence was retained without bullet rewrites.</p>}
        {changes.map((item, index) => <div key={index} className="border-2 border-[#1a1a1a] p-4 space-y-3">
          <h4 className="font-bold text-sm">{item.section}</h4>
          <p className="text-xs text-gray-600">{item.reason}</p>
          <div className="grid md:grid-cols-2 gap-4 text-sm leading-relaxed">
            <div className="p-3 border-l-4 border-[#e63b2e] bg-[#ffdad6]/60"><p className="font-bold mb-1">Before</p><p className="whitespace-pre-line">{item.original}</p></div>
            <div className="p-3 border-l-4 border-[#0055ff] bg-[#d6e3ff]/60"><p className="font-bold mb-1">After</p><p className="whitespace-pre-line">{item.tailored}</p></div>
          </div>
        </div>)}
      </section>
    </details>
  </div>;
}
