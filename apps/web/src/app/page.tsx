import Link from 'next/link';
import { Compass, ShieldCheck, CheckCircle2, Search, ArrowRight, Database, Terminal } from 'lucide-react';

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 p-6 md:p-8 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
            <span>Deterministic Ranking & Bounded Quotas</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Find, Validate, and Rank Trading Discord Communities
          </h1>
          <p className="mt-3 text-slate-300 text-sm md:text-base leading-relaxed">
            Multilingual search across 6 languages (EN, DE, ES, PT, FR, AR). Automatic canonicalization,
            Discord API verification, SSRF defense, and transparent scoring without scraping private servers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/discover"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/30"
            >
              <Compass className="w-4 h-4" />
              <span>Start Discovery Job</span>
            </Link>
            <Link
              href="/results"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition border border-slate-700"
            >
              <span>Explore Seed Demo Results</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Discovered Invites</span>
            <Search className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">48+</div>
          <p className="mt-1 text-xs text-slate-500">Across Google, Serper, and Tavily</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Verified Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">100% Validated</div>
          <p className="mt-1 text-xs text-slate-500">Via official Discord endpoints</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Supported Languages</span>
            <span className="text-xs font-mono text-purple-400">6 Codes</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-white">EN, DE, ES, PT, FR, AR</div>
          <p className="mt-1 text-xs text-slate-500">Native trading dictionary mapping</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>System State</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">Mock & Live Ready</div>
          <p className="mt-1 text-xs text-slate-500">Fastify API + Discord Bot + Next.js</p>
        </div>
      </div>

      {/* Dual Interface Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Discord Slash Commands</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Invoke directly inside your Discord server using guild-scoped slash commands:
          </p>
          <ul className="text-xs text-slate-300 space-y-2 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
            <li><span className="text-indigo-400">/ping</span> - Check bot and API latency</li>
            <li><span className="text-indigo-400">/hunt</span> topic:forex language:en - Queue bounded search</li>
            <li><span className="text-indigo-400">/verify</span> invite:https://discord.gg/... - Check invite status</li>
            <li><span className="text-indigo-400">/export</span> job:id format:csv - Download verified records</li>
          </ul>
        </div>

        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/30">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Explainable Scoring Model</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Every candidate is ranked with a deterministic 0-100 score based on verified facts:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold">35 pts:</span> Topic relevance
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold">20 pts:</span> Invite active/valid
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold">15 pts:</span> Language match
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold">10 pts:</span> Provenance / sources
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold">10 pts:</span> Verification freshness
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-indigo-400 font-bold">10 pts:</span> Verified member size
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

