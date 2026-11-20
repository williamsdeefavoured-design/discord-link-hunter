'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Sparkles, AlertCircle, CheckCircle2, Globe2 } from 'lucide-react';
import { DEFAULT_RESEARCH_SOURCES, getSelectableCountries } from '@discord-link-hunter/core';
import { apiFetch } from '../../lib/api';

const TOPICS = [
  { id: 'forex', name: 'Forex (FX Currency)' },
  { id: 'xauusd', name: 'Gold / XAUUSD' },
  { id: 'stocks', name: 'Stocks & Equities' },
  { id: 'crypto', name: 'Cryptocurrency' },
  { id: 'futures', name: 'Futures' },
  { id: 'options', name: 'Options Flow' },
  { id: 'indices', name: 'Indices (S&P 500, DAX)' },
  { id: 'day_trading', name: 'Day Trading & Scalping' },
  { id: 'swing_trading', name: 'Swing Trading' },
  { id: 'technical_analysis', name: 'Technical Analysis' },
  { id: 'investing', name: 'Investing' },
  { id: 'education', name: 'Trading Education' },
];

const LANGUAGES = [
  { id: 'en', name: 'English (en)' },
  { id: 'de', name: 'German (de)' },
  { id: 'es', name: 'Spanish (es)' },
  { id: 'pt', name: 'Portuguese (pt)' },
  { id: 'fr', name: 'French (fr)' },
  { id: 'ar', name: 'Arabic (ar)' },
  { id: 'it', name: 'Italian (it)' },
  { id: 'tr', name: 'Turkish (tr)' },
  { id: 'nl', name: 'Dutch (nl)' },
];

const SELECTABLE_COUNTRIES = getSelectableCountries();

export default function DiscoverPage() {
  const router = useRouter();
  const [topics, setTopics] = useState(['forex']);
  const [languages, setLanguages] = useState(['en']);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [country, setCountry] = useState('all');
  const [countrySearch, setCountrySearch] = useState('');
  const [limit, setLimit] = useState(10);
  const depth = limit;
  const mode = 'live' as const;
  const dryRun = false;
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; jobId?: string } | null>(null);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return SELECTABLE_COUNTRIES;
    const q = countrySearch.toLowerCase().trim();
    return SELECTABLE_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const result = await apiFetch<{ jobId: string; mode: string; message: string }>('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics,
          targetPlatforms: targetPlatforms.length ? targetPlatforms : undefined,
          languages,
          country: country !== 'all' ? country : undefined,
          limit,
          depth,
          mode,
          dryRun,
        }),
      });

      if (!result.ok) {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Failed to submit discovery job',
        });
        return;
      }

      const jobId = result.data?.jobId;
      setStatusMessage({
        type: 'success',
        text: `Job queued successfully (${jobId})! Mode: ${mode}${dryRun ? ' (Dry Run)' : ''}.`,
        jobId,
      });

      if (jobId) {
        setTimeout(() => {
          router.push(`/jobs?highlight=${jobId}`);
        }, 1500);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'An unexpected error occurred while submitting job.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="workspace-kicker mb-2">01 / RESEARCH SETUP</div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-[-0.04em] flex items-center space-x-2">
          <Compass className="w-6 h-6 text-indigo-400" />
          <span>Launch Community Discovery</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose a topic and language to prioritize. Active invites can still appear when those details are unconfirmed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-6">
        <div role="note" className="rounded-lg border border-[#31545c] bg-[#132b32] px-4 py-3 text-xs leading-relaxed text-[#b6d7d8]">
          <strong className="text-[#d5eeee]">Live discovery enabled.</strong> Searches use Serper / Tavily research requests and the configured provider limits.
        </div>

        {[
          { title: 'Trading topics', options: TOPICS, selected: topics, setSelected: setTopics },
          { title: 'Languages', options: LANGUAGES, selected: languages, setSelected: setLanguages },
        ].map(({ title, options, selected, setSelected }) => (
          <fieldset key={title} className="space-y-2">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map(({ id, name }) => (
                <label key={id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={selected.includes(id)} onChange={(event) => {
                    const checked = event.target.checked;
                    setSelected((current) => checked ? [...current, id] : current.filter((value) => value !== id));
                  }} />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {/* Country Selector (Strict Evidence-Based, Non-African ISO Alpha-2) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="country" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Country Focus
            </label>
            <span className="text-[11px] text-slate-500 font-normal">
              Non-African ISO Alpha-2
            </span>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              aria-label="Search countries by name or ISO code"
              placeholder="Filter country list by name or ISO code (e.g. Spain, DE, United Kingdom)..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Countries (Unrestricted)</option>
              {filteredCountries
                .filter((c) => c.code !== 'all')
                .concat(filteredCountries.some((c) => c.code === country) || country === 'all' ? [] : SELECTABLE_COUNTRIES.filter((c) => c.code === country))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
            </select>
          </div>
          {country !== 'all' ? (
            <p className="text-[11px] text-indigo-300/90 leading-relaxed">
              Searches prioritize {SELECTABLE_COUNTRIES.find((c) => c.code === country)?.name || country}. Active communities from other or unknown locations may also appear.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Country filtering is off. African countries and communities with unknown locations can appear if they meet the other filters.
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Source platforms</legend>
          <p className="text-xs text-slate-400">Leave all unchecked for unrestricted discovery. Searches cover indexed public pages, with coverage limited by each provider.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEFAULT_RESEARCH_SOURCES.filter((source) => source.enabled).map((source) => (
              <label key={source.id} className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={targetPlatforms.includes(source.id)} onChange={(event) => {
                  const checked = event.target.checked;
                  setTargetPlatforms((current) => checked
                    ? [...current, source.id]
                    : current.filter((id) => id !== source.id));
                }} />
                {source.name}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Budget Controls */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label htmlFor="limit" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Search depth
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={5}>5× · Up to 5 communities · ~30 seconds</option>
              <option value={10}>10× · Up to 10 communities · ~1 minute</option>
              <option value={20}>20× Extended · Up to 20 communities · ~2 minutes</option>
            </select>
          </div>

          <p className="text-xs text-slate-400">Deeper searches try more queries across your selected sources. Jobs can finish early if the search plan is exhausted.</p>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <span>Starting job...</span>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Submit Discovery Job</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
