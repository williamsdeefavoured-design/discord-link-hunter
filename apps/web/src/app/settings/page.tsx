'use client';

import { useEffect, useState } from 'react';
import { Settings, Shield, Cpu, Activity, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export default function SettingsPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const result = await apiFetch('/health');
      if (result.ok && result.data) {
        setHealthData(result.data);
        setErrorMessage(null);
      } else {
        setErrorMessage(result.error || 'Failed to retrieve system health');
      }
    } catch (err: any) {
      console.error('Failed to load health data:', err);
      setErrorMessage(err.message || 'Failed to load health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="workspace-kicker mb-2">04 / SYSTEM DIAGNOSTICS</div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-[-0.04em] flex items-center space-x-2">
            <Settings className="w-6 h-6 text-indigo-400" />
            <span>Settings & System Health</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Runtime quotas, external provider configuration, and safe environment diagnostics.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
          title="Refresh Health"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quota Management */}
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center space-x-2 font-bold text-white text-base">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>Search Quotas & Rate Limits</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Max Queries Per Job:</span>
              <span className="font-mono text-white font-semibold">
                {healthData?.config?.quotas?.maxQueriesPerJob || 12}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Max Results Per Query:</span>
              <span className="font-mono text-white font-semibold">
                {healthData?.config?.quotas?.maxResultsPerQuery || 10}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Max Search Depth:</span>
              <span className="font-mono text-white font-semibold">
                {healthData?.config?.quotas?.maxDepth || 2}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Max Concurrency:</span>
              <span className="font-mono text-white font-semibold">
                {healthData?.config?.quotas?.maxConcurrent || 2}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Daily Provider Cap:</span>
              <span className="font-mono text-white font-semibold">
                {healthData?.config?.quotas?.dailyProviderCap || 50} requests
              </span>
            </div>
          </div>
        </div>

        {/* Provider Connectivity */}
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center space-x-2 font-bold text-white text-base">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>Service Connectivity</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Serper Search Provider:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  healthData?.providers?.serper
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {healthData?.providers?.serper ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Tavily Research Provider:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  healthData?.providers?.tavily
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {healthData?.providers?.tavily ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Discord Gateway:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  healthData?.config?.hasDiscordToken
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {healthData?.config?.hasDiscordToken ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <div className="flex flex-col space-y-1.5 py-2 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Database Engine:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    healthData?.database?.connected
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {healthData?.database?.connected
                    ? 'Connected (Supabase PostgreSQL)'
                    : 'In-Memory Repository (Fallback)'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Persistence Layer:</span>
                <span className="text-slate-200">
                  {healthData?.database?.connected
                    ? 'PostgreSQL Persistent Storage'
                    : 'Local File Store (data/jobs-store.json)'}
                </span>
              </div>
              {healthData?.database?.endpoint && (
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Endpoint:</span>
                  <span className="text-slate-200">{healthData.database.endpoint}</span>
                </div>
              )}
              {!healthData?.database?.connected && healthData?.database?.error && (
                <div className="text-[11px] text-amber-400 mt-1 font-mono">
                  Notice: {healthData.database.error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
