'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ListFilter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  ClipboardList,
  Info,
  Play,
  Sparkles,
} from 'lucide-react';
import { SearchJob } from '@discord-link-hunter/core';
import { apiFetch } from '../../lib/api';

export default function JobsPage() {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executingJob, setExecutingJob] = useState<SearchJob | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);

  const fetchJobs = async () => {
    try {
      const result = await apiFetch<{ jobs: SearchJob[] }>('/api/jobs');
      if (result.ok && result.data?.jobs) {
        setJobs(result.data.jobs.filter((job) => job.mode === 'live' && !job.isSimulated));
        setErrorMessage(null);
      } else if (!result.ok) {
        setErrorMessage(result.error || 'Failed to fetch jobs');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const timer = setInterval(fetchJobs, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleCancel = async (jobId: string) => {
    try {
      await apiFetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      fetchJobs();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const handleExecutePlan = async (jobId: string) => {
    setExecutionLoading(true);
    try {
      const res = await apiFetch<{ jobId: string; message: string }>(`/api/jobs/${jobId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok && res.data?.jobId) {
        setExecutingJob(null);
        await fetchJobs();
      } else {
        alert(res.error || 'Failed to execute planned search');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing search');
    } finally {
      setExecutionLoading(false);
    }
  };

  const getStatusBadge = (status: SearchJob['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'dry_run_plan':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            <ClipboardList className="w-3 h-3" />
            <span>Dry Run — Plan Generated</span>
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Running</span>
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Partial</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="workspace-kicker mb-2">02 / EXECUTION LOG</div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-[-0.04em] flex items-center space-x-2">
            <ListFilter className="w-6 h-6 text-indigo-400" />
            <span>Search Jobs Execution Monitor</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time status, query execution progress, invite verification counts, and provider diagnostics.
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchJobs();
          }}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
          title="Refresh Jobs"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-400 space-y-3">
          <p>No search jobs recorded yet.</p>
          <Link
            href="/discover"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
          >
            <span>Launch a Discovery Job</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const pct =
              job.progress.queriesPlanned > 0
                ? Math.round((job.progress.queriesExecuted / job.progress.queriesPlanned) * 100)
                : 0;

            return (
              <div
                key={job.id}
                className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-semibold text-white">{job.id}</span>
                    {getStatusBadge(job.status)}
                    {job.mode === 'live' && !job.isSimulated ? (
                      <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ⚡ LIVE DISCOVERY
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        🧪 SIMULATED MOCK
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                    <Link
                      href={`/results?job=${job.id}`}
                      className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      <span>View Results</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Dry Run Plan Section */}
                {job.status === 'dry_run_plan' && (
                  <div className="p-4 rounded-lg bg-cyan-950/30 border border-cyan-800/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 text-cyan-300 font-semibold text-xs">
                        <ClipboardList className="w-4 h-4 text-cyan-400" />
                        <span>Dry Run Plan — Multi-lingual Search Strategy</span>
                      </div>
                      <button
                        onClick={() => setExecutingJob(job)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Execute This Search</span>
                      </button>
                    </div>

                    {job.dryRunExplanation && (
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                        {job.dryRunExplanation}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Planned Queries:</span>{' '}
                        <span className="font-mono text-cyan-300 font-semibold">{job.plannedQueries?.length ?? job.progress.queriesPlanned}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Est. API Requests:</span>{' '}
                        <span className="font-mono text-cyan-300 font-semibold">{job.estimatedRequests ?? job.progress.queriesPlanned}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Est. Credits:</span>{' '}
                        <span className="font-mono text-cyan-300 font-semibold">{job.estimatedCredits ?? job.progress.queriesPlanned}</span>
                      </div>
                    </div>

                    {job.plannedQueries && job.plannedQueries.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Planned Search Queries:</div>
                        <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-xs">
                          {job.plannedQueries.map((pq, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300">
                              <span className="text-cyan-400 truncate mr-2">{pq.query}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                                {pq.topic} • {pq.language}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>
                      Queries: {job.progress.queriesAttempted ?? job.progress.queriesExecuted} / {job.progress.queriesPlanned}
                      {job.progress.queriesFailed > 0 && (
                        <span className="text-rose-400 ml-2">({job.progress.queriesFailed} failed)</span>
                      )}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                  <div>
                    <span className="text-slate-500">URLs Discovered:</span>{' '}
                    <span className="font-mono text-slate-200">{job.progress.urlsDiscovered}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Unique Invites:</span>{' '}
                    <span className="font-mono text-slate-200">{job.progress.uniqueInvites ?? job.progress.invitesExtracted}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Checked / Verified:</span>{' '}
                    <span className="font-mono text-slate-200">{job.progress.invitesChecked ?? job.progress.invitesVerified}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Valid Active:</span>{' '}
                    <span className="font-mono text-emerald-400 font-bold">{job.progress.validInvites ?? job.progress.validInvitesFound}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Invalid / Expired:</span>{' '}
                    <span className="font-mono text-rose-400 font-bold">{job.progress.invalidInvites ?? 0}</span>
                  </div>
                </div>

                {job.errorDetails && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                    <span className="font-semibold">Error:</span> {job.errorDetails}
                  </div>
                )}

                {job.progress.providerErrors.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 space-y-1">
                    <div className="font-semibold">Provider Diagnostics:</div>
                    {job.progress.providerErrors.map((err, i) => (
                      <div key={i}>
                        [{err.provider}] {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Executing Search */}
      {executingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center space-x-3 text-white">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Play className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Confirm Search Execution</h3>
                <p className="text-xs text-slate-400 font-mono">Job: {executingJob.id}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2.5">
              <p className="leading-relaxed">
                You are about to launch live discovery for this search plan. This will execute search queries across external web providers (Serper/Tavily) and verify discovered Discord invitations.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-slate-400">
                <div>
                  <span className="text-slate-500">Topics:</span>{' '}
                  <span className="text-slate-200 font-medium">{executingJob.params.topics.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Languages:</span>{' '}
                  <span className="text-slate-200 font-medium">{executingJob.params.languages.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Est. API Requests:</span>{' '}
                  <span className="text-indigo-400 font-bold font-mono">{executingJob.estimatedRequests ?? executingJob.progress.queriesPlanned}</span>
                </div>
                <div>
                  <span className="text-slate-500">Est. Credit Cost:</span>{' '}
                  <span className="text-indigo-400 font-bold font-mono">{executingJob.estimatedCredits ?? executingJob.progress.queriesPlanned} credits</span>
                </div>
              </div>
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                ⚠️ Daily provider limits apply. Execution will respect your configured daily API budget cap.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setExecutingJob(null)}
                disabled={executionLoading}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecutePlan(executingJob.id)}
                disabled={executionLoading}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition"
              >
                {executionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Confirm & Execute Search</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
