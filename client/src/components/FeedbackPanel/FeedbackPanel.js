import React from 'react';
import { Award, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';

export default function FeedbackPanel({ feedback }) {
  if (!feedback) return null;

  const dimensions = [
    { label: 'Clarity', score: feedback.clarityScore || 0, color: 'bg-[#ffcc00]' },
    { label: 'Relevance', score: feedback.relevanceScore || 0, color: 'bg-[#0055ff]' },
    { label: 'Structure / STAR', score: feedback.structureScore || 0, color: 'bg-[#e63b2e]' },
    { label: 'Technical Depth', score: feedback.technicalScore || 0, color: 'bg-[#1a1a1a]' },
  ];

  return (
    <div className="p-5 border-3 border-[#1a1a1a] bg-[#faf7f2] shadow-brutal space-y-4">
      {/* Header with Overall Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#ffcc00] border-2 border-[#1a1a1a] shadow-brutal">
            <Award className="w-5 h-5 text-[#1a1a1a]" />
          </div>
          <div>
            <h4 className="font-headline font-black text-sm uppercase tracking-wide text-[#1a1a1a]">
              Evaluator Agent Scorecard
            </h4>
            {feedback.starAdherence && (
              <span className="text-[10px] font-bold uppercase text-gray-600">
                STAR Rating: {feedback.starAdherence}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-headline font-bold text-xs uppercase text-gray-600">
            Overall Score:
          </span>
          <span className="px-3 py-1 bg-[#1a1a1a] text-[#ffcc00] border-2 border-[#1a1a1a] font-headline font-black text-lg shadow-brutal">
            {feedback.overallScore}/100
          </span>
        </div>
      </div>

      {/* 4 Dimension Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {dimensions.map((dim, idx) => (
          <div key={idx} className="p-3 border-2 border-[#1a1a1a] bg-white shadow-brutal">
            <div className="flex justify-between text-[11px] font-headline font-black uppercase mb-1">
              <span>{dim.label}</span>
              <span>{dim.score}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 border border-[#1a1a1a]">
              <div
                className={`h-full ${dim.color}`}
                style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
        <div className="p-3 border-2 border-[#1a1a1a] bg-green-50">
          <h5 className="font-headline font-black text-xs uppercase text-green-900 flex items-center gap-1.5 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-700" />
            <span>Demonstrated Strengths</span>
          </h5>
          <ul className="space-y-1">
            {(feedback.strengths || []).map((s, idx) => (
              <li key={idx} className="text-green-950 font-medium leading-tight">
                • {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 border-2 border-[#1a1a1a] bg-amber-50">
          <h5 className="font-headline font-black text-xs uppercase text-amber-900 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Target Areas for Improvement</span>
          </h5>
          <ul className="space-y-1">
            {(feedback.improvements || []).map((imp, idx) => (
              <li key={idx} className="text-amber-950 font-medium leading-tight">
                • {imp}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Detailed Evaluator Comments */}
      {feedback.comments && (
        <div className="p-3 bg-white border-2 border-[#1a1a1a] text-xs text-gray-800 leading-relaxed font-medium">
          <span className="font-headline font-black uppercase text-[10px] text-[#0055ff] block mb-1">
            Feedback Synthesis:
          </span>
          {feedback.comments}
        </div>
      )}

      {feedback.aiProvider && (
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0055ff]" />
          <span>Evaluated by: {feedback.aiProvider}</span>
        </div>
      )}
    </div>
  );
}
