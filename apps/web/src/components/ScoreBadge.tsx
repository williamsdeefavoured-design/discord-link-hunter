'use client';

import { useState } from 'react';
import { ScoreBreakdown } from '@discord-link-hunter/core';
import { Info } from 'lucide-react';

interface ScoreBadgeProps {
  score: number;
  breakdown?: ScoreBreakdown;
}

export function ScoreBadge({ score, breakdown }: ScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  let colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (score < 50) {
    colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  } else if (score < 75) {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer ${colorClasses}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <span>{score}/100</span>
        <Info className="w-3 h-3 opacity-60" />
      </div>

      {showTooltip && breakdown && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300">
          <div className="font-semibold text-white mb-1.5 pb-1 border-b border-slate-800 flex justify-between">
            <span>Score Breakdown</span>
            <span className="text-indigo-400">{score}/100</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Relevance:</span>
              <span className="font-mono text-slate-200">+{breakdown.topicRelevance}/35</span>
            </div>
            <div className="flex justify-between">
              <span>Invite Active:</span>
              <span className="font-mono text-slate-200">+{breakdown.inviteValidity}/20</span>
            </div>
            <div className="flex justify-between">
              <span>Language:</span>
              <span className="font-mono text-slate-200">+{breakdown.languageMatch}/15</span>
            </div>
            <div className="flex justify-between">
              <span>Provenance:</span>
              <span className="font-mono text-slate-200">+{breakdown.sourceCredibility}/10</span>
            </div>
            <div className="flex justify-between">
              <span>Freshness:</span>
              <span className="font-mono text-slate-200">+{breakdown.freshness}/10</span>
            </div>
            <div className="flex justify-between">
              <span>Verified Size:</span>
              <span className="font-mono text-slate-200">+{breakdown.activitySignal}/10</span>
            </div>
          </div>
          {breakdown.explanations && breakdown.explanations.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[11px] text-slate-400 space-y-0.5">
              {breakdown.explanations.slice(0, 3).map((exp, i) => (
                <div key={i}>• {exp}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

