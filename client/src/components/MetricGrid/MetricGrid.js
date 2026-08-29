import React from 'react';
import { FileText, Award, Mic, KanbanSquare, ArrowUpRight } from 'lucide-react';

export default function MetricGrid({ metrics }) {
  const cards = [
    {
      title: 'Uploaded Resumes',
      value: metrics?.totalResumes ?? 0,
      label: `${metrics?.totalTailored || 0} Tailored Versions`,
      accent: 'border-l-8 border-l-[#ffcc00]',
      bgAccent: 'bg-[#ffcc00]/20',
      icon: FileText,
    },
    {
      title: 'Avg ATS Compatibility',
      value: `${metrics?.avgAtsScore ?? 0}%`,
      label: (metrics?.avgAtsScore || 0) >= 80 ? 'ATS Optimized' : 'Needs Optimization',
      accent: 'border-l-8 border-l-[#0055ff]',
      bgAccent: 'bg-[#0055ff]/20',
      icon: Award,
    },
    {
      title: 'Avg Interview Score',
      value: `${metrics?.avgInterviewScore ?? 0}%`,
      label: `${metrics?.interviewTrends?.length || 0} Sessions Evaluated`,
      accent: 'border-l-8 border-l-[#e63b2e]',
      bgAccent: 'bg-[#e63b2e]/20',
      icon: Mic,
    },
    {
      title: 'Active Applications',
      value: metrics?.applicationFunnel?.total ?? 0,
      label: `${metrics?.applicationFunnel?.interview || 0} In Interview Stage`,
      accent: 'border-l-8 border-l-[#1a1a1a]',
      bgAccent: 'bg-[#1a1a1a]/10',
      icon: KanbanSquare,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`brutal-card p-5 ${card.accent} flex flex-col justify-between`}
          >
            <div className="flex items-start justify-between">
              <span className="font-headline font-bold text-xs uppercase tracking-wider text-gray-700">
                {card.title}
              </span>
              <div className={`p-2 border-2 border-[#1a1a1a] ${card.bgAccent}`}>
                <Icon className="w-4 h-4 text-[#1a1a1a]" />
              </div>
            </div>
            <div className="mt-4">
              <div className="font-headline font-black text-3xl sm:text-4xl text-[#1a1a1a]">
                {card.value}
              </div>
              <div className="mt-1 text-xs font-bold text-gray-600 flex items-center gap-1">
                <span>{card.label}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
