'use client';

import { useId, useState } from 'react';
import { ScoreBreakdown } from '@discord-link-hunter/core';
import { Info } from 'lucide-react';

interface ScoreBadgeProps {
  score: number;
  breakdown?: ScoreBreakdown;
}

export function ScoreBadge({ score, breakdown }: ScoreBadgeProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const tone = score >= 75 ? 'text-[#75cdb5]' : score >= 50 ? 'text-[#d9b478]' : 'text-[#d49e9e]';

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-label={`Relevance score ${score} out of 100${breakdown ? '. Show score details' : ''}`}
        aria-expanded={breakdown ? open : undefined}
        aria-describedby={breakdown && open ? id : undefined}
        className={`inline-flex items-center gap-1.5 rounded-md border border-[#324253] bg-[#182532] px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums ${tone} hover:border-[#58778a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8ac1ca]`}
        onMouseEnter={() => breakdown && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => breakdown && setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => breakdown && setOpen((value) => !value)}
      >
        <span>{score}<span className="text-[#718b9d] font-normal"> / 100</span></span>
        {breakdown && <Info className="h-3 w-3 opacity-65" aria-hidden="true" />}
      </button>

      {breakdown && open && (
        <div id={id} role="tooltip" className="absolute z-50 bottom-full mb-2 left-0 w-[272px] max-w-[85vw] rounded-lg border border-[#345062] bg-[#101c29] p-3.5 shadow-[0_14px_45px_#0008] text-xs text-[#b6c9d7]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#304154]">
            <span className="font-semibold text-[#edf4f7]">Evidence breakdown</span><span className="font-mono text-[#9dcbd3]">{score} / 100</span>
          </div>
          <div className="space-y-1.5">
            {[
              ['Topic relevance', breakdown.topicRelevance, 35],
              ['Invite status', breakdown.inviteValidity, 20],
              ['Language', breakdown.languageMatch, 15],
              ['Provenance', breakdown.sourceCredibility, 10],
              ['Freshness', breakdown.freshness, 10],
              ['Community size', breakdown.activitySignal, 10],
            ].map(([name, value, max]) => (
              <div className="flex justify-between gap-2" key={name}>
                <span>{name}</span><span className="text-[#e8eff4] font-mono">{value} / {max}</span>
              </div>
            ))}
          </div>
          {breakdown.explanations?.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[#304154] text-[11px] text-[#91acbb] space-y-1">
              {breakdown.explanations.slice(0, 3).map((explanation, index) => <div key={index}>{explanation}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
