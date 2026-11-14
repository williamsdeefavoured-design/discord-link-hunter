'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  { id: 'education', name: 'Trading Education' },
];

const LANGUAGES = [
  { id: 'en', name: 'English (en)' },
  { id: 'de', name: 'German (de)' },
  { id: 'es', name: 'Spanish (es)' },
  { id: 'pt', name: 'Portuguese (pt)' },
  { id: 'fr', name: 'French (fr)' },
  { id: 'ar', name: 'Arabic (ar)' },
];

export default function DiscoverPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('forex');
  const [language, setLanguage] = useState('en');
  const [limit, setLimit] = useState(10);
  const [depth, setDepth] = useState(1);
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; jobId?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const result = await apiFetch<{ jobId: string; mode: string; message: string }>('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: [topic],
          languages: [language],
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
          Configure a targeted, bounded search across trading sectors and international languages.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-6">
        {/* Mode Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Execution Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('mock')}
              className={`p-3 rounded-lg border text-left transition ${
                mode === 'mock'
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-sm">🧪 Mock Mode (Safe)</div>
              <div className="text-xs text-slate-400 mt-1">
                Zero search credits consumed. Uses realistic fixtures for testing.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('live')}
              className={`p-3 rounded-lg border text-left transition ${
                mode === 'live'
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-sm">⚡ Live Mode</div>
              <div className="text-xs text-slate-400 mt-1">
                Executes live queries via Serper & Tavily with daily budget cap.
              </div>
            </button>
          </div>
        </div>

        {/* Topic Selector */}
        <div className="space-y-2">
          <label htmlFor="topic" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Trading Sector / Topic
          </label>
          <select
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Language Selector */}
        <div className="space-y-2">
          <label htmlFor="language" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Language Focus
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Budget Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="limit" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Result Limit
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={5}>5 Communities (Fast)</option>
              <option value={10}>10 Communities (Standard)</option>
              <option value={20}>20 Communities (Extended)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="depth" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Search Depth
            </label>
            <select
              id="depth"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={1}>Depth 1 (Serper Google Indexed)</option>
              <option value={2}>Depth 2 (Deep Tavily Expansion)</option>
            </select>
          </div>
        </div>

        {/* Dry run option */}
        <div className="flex items-center space-x-2 pt-2">
          <input
            id="dryRun"
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
          />
          <label htmlFor="dryRun" className="text-xs text-slate-400 cursor-pointer">
            Dry Run only (estimate query plan and credit consumption without executing searches)
          </label>
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
