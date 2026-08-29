import React from 'react';
import { PlusCircle, MinusCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ResumeDiffView({ diff, originalResume, tailoredContent, targetRole }) {
  const addedSkills = diff?.addedSkills || [];
  const modifiedHighlights = diff?.modifiedHighlights || [];
  const summaryDiff = diff?.summaryDiff || {};

  return (
    <div className="space-y-6">
      {/* Target Role & Highlights banner */}
      <div className="p-4 border-3 border-[#1a1a1a] bg-[#ffcc00] shadow-brutal flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">
            Tailored Objective
          </span>
          <h3 className="font-headline font-black text-xl text-[#1a1a1a] uppercase">
            {targetRole}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-white border-2 border-[#1a1a1a] text-xs font-black uppercase text-[#0055ff] shadow-brutal">
            +{addedSkills.length} Injected Skills
          </span>
          <span className="px-2.5 py-1 bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] text-xs font-black uppercase shadow-brutal">
            {modifiedHighlights.length} Bullets Re-engineered
          </span>
        </div>
      </div>

      {/* Summary Diff Section */}
      <div className="brutal-card p-5">
        <h4 className="font-headline font-black text-base uppercase text-[#1a1a1a] mb-4 pb-2 border-b-2 border-[#1a1a1a]">
          Executive Summary Diff
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
            <span className="text-[10px] font-black uppercase text-gray-500 block mb-1">
              Original Summary
            </span>
            <p className="text-xs text-gray-700 leading-relaxed font-normal">
              {summaryDiff.original || originalResume?.parsedData?.summary || 'No original summary provided.'}
            </p>
          </div>
          <div className="p-4 border-2 border-[#1a1a1a] bg-[#d6e3ff]">
            <span className="text-[10px] font-black uppercase text-[#0055ff] block mb-1">
              Tailored Summary (+ Role Keywords)
            </span>
            <p className="text-xs text-[#1a1a1a] leading-relaxed font-medium">
              {summaryDiff.tailored || tailoredContent?.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Skill Additions Section */}
      {addedSkills.length > 0 && (
        <div className="brutal-card p-5">
          <h4 className="font-headline font-black text-base uppercase text-[#1a1a1a] mb-3 pb-2 border-b-2 border-[#1a1a1a] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#ffcc00]" />
            <span>Target Role Keyword Enhancements</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {addedSkills.map((skill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 border-2 border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] font-bold text-xs uppercase shadow-brutal"
              >
                <PlusCircle className="w-3.5 h-3.5 text-green-800" />
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Work Experience Bullet Modifications */}
      <div className="brutal-card p-5">
        <h4 className="font-headline font-black text-base uppercase text-[#1a1a1a] mb-4 pb-2 border-b-2 border-[#1a1a1a]">
          Work Experience Bullets — Side-by-Side Diff
        </h4>

        {modifiedHighlights.length === 0 ? (
          <p className="text-xs text-gray-600 font-medium">No highlights modified.</p>
        ) : (
          <div className="space-y-4">
            {modifiedHighlights.map((item, idx) => (
              <div key={idx} className="p-4 border-2 border-[#1a1a1a] bg-white shadow-brutal space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-gray-200">
                  <span className="font-headline font-bold text-xs uppercase text-[#1a1a1a]">
                    {item.section}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-[#0055ff] bg-[#d6e3ff] px-2 py-0.5 border border-[#1a1a1a]">
                    {item.reason}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-[#ffdad6]/60 border-l-4 border-[#e63b2e] text-gray-800">
                    <span className="text-[10px] font-black uppercase text-[#e63b2e] block mb-1">
                      Before
                    </span>
                    <p className="line-through decoration-[#e63b2e]">{item.original}</p>
                  </div>
                  <div className="p-3 bg-[#d6e3ff]/60 border-l-4 border-[#0055ff] text-[#1a1a1a] font-medium">
                    <span className="text-[10px] font-black uppercase text-[#0055ff] block mb-1">
                      Tailored (Optimized Metrics & Verbs)
                    </span>
                    <p>{item.tailored}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
