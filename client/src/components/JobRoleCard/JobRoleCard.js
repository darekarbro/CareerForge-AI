import React from 'react';
import { ExternalLink, Sparkles, Compass } from 'lucide-react';

export default function JobRoleCard({ role, generatedLinks, keywords, onGenerateCustom }) {
  const defaultKeywords = keywords || role.defaultKeywords || [];

  // Platform styling badges
  const platforms = [
    {
      name: 'LinkedIn Jobs',
      url: generatedLinks?.linkedin || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role.title)}`,
      btnClass: 'bg-[#0077b5] text-white hover:bg-[#005582]',
    },
    {
      name: 'Internshala',
      url: generatedLinks?.internshala || `https://internshala.com/jobs/keywords-${encodeURIComponent(role.id)}/`,
      btnClass: 'bg-[#12957f] text-white hover:bg-[#0d6e5d]',
    },
    {
      name: 'Naukri',
      url: generatedLinks?.naukri || `https://www.naukri.com/${encodeURIComponent(role.id)}-jobs`,
      btnClass: 'bg-[#ff7555] text-white hover:bg-[#e05636]',
    },
    {
      name: 'Indeed',
      url: generatedLinks?.indeed || `https://www.indeed.com/jobs?q=${encodeURIComponent(role.title)}`,
      btnClass: 'bg-[#2164f3] text-white hover:bg-[#144ec2]',
    },
  ];

  return (
    <div className="brutal-card p-6 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="px-2 py-0.5 bg-[#1a1a1a] text-[#ffcc00] border-2 border-[#1a1a1a] font-headline font-black text-[10px] uppercase">
            {role.category || 'Engineering'}
          </span>
          <span className="text-[11px] font-bold text-gray-500 uppercase">
            Deep-Linked Hub
          </span>
        </div>

        <h3 className="font-headline font-black text-lg text-[#1a1a1a] uppercase leading-tight">
          {role.title}
        </h3>
        <p className="text-xs text-gray-600 font-medium mt-1 leading-relaxed">
          {role.description}
        </p>

        {/* AI Keywords tags */}
        <div className="mt-4 pt-3 border-t-2 border-[#1a1a1a]">
          <span className="font-headline font-bold text-[10px] uppercase text-gray-600 block mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#0055ff]" />
            Target Keywords:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {defaultKeywords.map((kw, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 border border-[#1a1a1a] bg-[#f5f0e8] text-[11px] font-bold text-[#1a1a1a]"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Deep-Link Buttons */}
      <div className="pt-3 border-t-2 border-[#1a1a1a] space-y-2">
        <span className="font-headline font-black text-[10px] uppercase text-gray-700 block">
          Open Filtered Public Search:
        </span>
        <div className="grid grid-cols-2 gap-2">
          {platforms.map((p, idx) => (
            <a
              key={idx}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 border-2 border-[#1a1a1a] font-headline font-bold text-xs uppercase flex items-center justify-between shadow-brutal transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 ${p.btnClass}`}
            >
              <span>{p.name}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
