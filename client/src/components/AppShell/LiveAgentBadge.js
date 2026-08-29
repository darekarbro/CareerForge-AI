import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const agentColors = {
  parser: 'bg-[#ffcc00] text-[#1a1a1a]',
  analyzer: 'bg-[#0055ff] text-white',
  generator: 'bg-[#1a1a1a] text-[#ffcc00]',
  evaluator: 'bg-[#e63b2e] text-white',
  recovery: 'bg-[#ff8800] text-white',
  monitoring: 'bg-[#eee9e0] text-[#1a1a1a]',
  orchestrator: 'bg-[#1a1a1a] text-white',
};

export default function LiveAgentBadge({ agent = 'orchestrator', status = 'active', message }) {
  const badgeClass = agentColors[agent.toLowerCase()] || 'bg-[#1a1a1a] text-white';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-[#1a1a1a] bg-white shadow-brutal text-xs font-bold uppercase tracking-wider">
      <div className={`px-2 py-0.5 border border-[#1a1a1a] ${badgeClass} font-black`}>
        {agent}
      </div>
      {status === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0055ff]" />}
      {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
      {status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
      {message && <span className="font-medium lowercase text-[#1a1a1a] max-w-xs truncate">{message}</span>}
    </div>
  );
}
