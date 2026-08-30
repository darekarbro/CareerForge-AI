import React from 'react';
import { Cpu, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import LiveAgentBadge from '../AppShell/LiveAgentBadge';

export default function ProcessingTimeline({ events = [], isRunning = false, title = 'Agentic Execution Timeline' }) {
  return (
    <div className="brutal-card p-5">
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#1a1a1a] mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#1a1a1a] text-[#ffcc00] border-2 border-[#1a1a1a]">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="font-headline font-black text-base uppercase tracking-wider text-[var(--text-main)]">
            {title}
          </h3>
        </div>
        {isRunning && (
          <span className="px-2 py-0.5 bg-[#ffcc00] border border-[#1a1a1a] text-[10px] font-black uppercase animate-pulse text-[#1a1a1a]">
            Live Stream Active
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-muted)] font-medium text-xs uppercase">
          Waiting for agent pipeline execution to initiate...
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#1a1a1a]">
          {events.map((evt, idx) => {
            const isLast = idx === events.length - 1;
            const levelColor =
              evt.level === 'success'
                ? 'text-green-700'
                : evt.level === 'warning'
                ? 'text-amber-700'
                : evt.level === 'error'
                ? 'text-red-700'
                : 'text-[#1a1a1a]';

            return (
              <div key={idx} className="relative pl-9 text-xs">
                <div className="absolute left-2.5 top-1.5 w-3.5 h-3.5 bg-white border-2 border-[#1a1a1a] rounded-full transform -translate-x-1/2 flex items-center justify-center">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      evt.level === 'success'
                        ? 'bg-green-600'
                        : evt.level === 'error'
                        ? 'bg-red-600'
                        : 'bg-[#0055ff]'
                    }`}
                  />
                </div>

                <div className="p-2.5 border-2 border-[#1a1a1a] bg-[var(--surface-elevated)] shadow-brutal flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <LiveAgentBadge
                      agent={evt.agent || 'orchestrator'}
                      status={evt.level === 'success' ? 'success' : isLast && isRunning ? 'active' : 'idle'}
                    />
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)]">
                      {evt.durationMs ? <span>{evt.durationMs}ms</span> : null}
                      <span>
                        {evt.timestamp
                          ? new Date(evt.timestamp).toLocaleTimeString()
                          : new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <p className={`font-medium leading-snug mt-1 ${levelColor}`}>
                    {evt.message}
                  </p>
                  {evt.metadata?.aiProvider && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--text-main)] bg-[var(--surface-strong)] px-1.5 py-0.5 border border-[#1a1a1a] w-fit">
                      <ShieldCheck className="w-3 h-3 text-[#0055ff]" />
                      Provider: {evt.metadata.aiProvider}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
