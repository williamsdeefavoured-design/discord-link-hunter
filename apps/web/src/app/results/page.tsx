'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Download, ExternalLink, Filter, Users, Globe2, Tag, ClipboardList, Play, RefreshCw, ArrowRight } from 'lucide-react';
import { RankedInviteResult } from '@discord-link-hunter/core';
import { ScoreBadge } from '../../components/ScoreBadge';
import { apiFetch } from '../../lib/api';

function ResultsContent() {
  const searchParams = useSearchParams();
  const requestedJobId = searchParams.get('job');

  const [jobId, setJobId] = useState<string>(requestedJobId || '');
  const [job, setJob] = useState<any>(null);
  const [jobMode, setJobMode] = useState<'mock' | 'live' | null>(null);
  const [jobIsSimulated, setJobIsSimulated] = useState<boolean>(false);
  const [results, setResults] = useState<RankedInviteResult[]>([]);
  const [potentialLeads, setPotentialLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Filters
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState('valid');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  // Resolve active jobId if not provided in URL
  useEffect(() => {
    if (!jobId) {
      apiFetch<{ jobs: { id: string }[] }>('/api/jobs?limit=1')
        .then((res) => {
          if (res.ok && res.data?.jobs && res.data.jobs.length > 0) {
            setJobId(res.data.jobs[0].id);
          } else {
            setJobId('job-seed-demo-01');
          }
        })
        .catch(() => {
          setJobId('job-seed-demo-01');
        });
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    // Fetch job metadata
    apiFetch<any>(`/api/jobs/${jobId}`)
      .then((res) => {
        if (res.ok && res.data) {
          setJob(res.data);
          setJobMode(res.data.mode);
          setJobIsSimulated(Boolean(res.data.isSimulated || res.data.mode === 'mock'));
        }
      })
      .catch(() => {});

    const fetchResults = async () => {
      setLoading(true);
      try {
        let url = `/api/results/${jobId}`;
        const params = new URLSearchParams();
        if (minScore > 0) params.append('minScore', minScore.toString());
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (languageFilter !== 'all') params.append('language', languageFilter);
        if (platformFilter !== 'all') params.append('platform', platformFilter);

        const qs = params.toString();
        if (qs) url += `?${qs}`;

        const result = await apiFetch<{ results: RankedInviteResult[]; potentialLeads?: any[] }>(url);
        if (result.ok && result.data?.results) {
          setResults(result.data.results);
          setPotentialLeads(result.data.potentialLeads || []);
          setErrorMessage(null);
        } else {
          setResults([]);
          setPotentialLeads([]);
          if (!result.ok) {
            setErrorMessage(result.error || 'Failed to load results');
          }
        }
      } catch (err: any) {
        console.error('Failed to load results:', err);
        setErrorMessage(err.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [jobId, minScore, statusFilter, languageFilter, platformFilter]);

  const handleExecuteLiveSearch = async () => {
    if (!job) return;
    setExecuting(true);
    try {
      const res = await apiFetch<{ jobId: string; message: string }>(`/api/jobs/${job.id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok && res.data?.jobId) {
        setShowConfirmModal(false);
        window.location.href = `/jobs`;
      } else {
        alert(res.error || 'Failed to execute planned search');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing search');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
              <span>Ranked Discord Communities</span>
            </h1>
            {job?.status === 'dry_run_plan' ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                📋 DRY RUN — PLAN GENERATED
              </span>
            ) : jobMode === 'live' && !jobIsSimulated ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ⚡ LIVE DISCOVERY
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                🧪 SIMULATED MOCK
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Job: <span className="font-mono text-slate-200">{jobId || 'Loading...'}</span> • Evaluated with deterministic scoring model.
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center space-x-2">
          <a
            href={`/api/export/${jobId}?format=csv`}
            download
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <a
            href={`/api/export/${jobId}?format=json`}
            download
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </a>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs">
          ⚠️ {errorMessage}
        </div>
      )}

      {job?.languageFilterNotice && (
        <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs flex items-center space-x-2">
          <Globe2 className="w-4 h-4 shrink-0 text-indigo-400" />
          <span>{job.languageFilterNotice}</span>
        </div>
      )}

      {/* Dry Run Plan View vs Standard Results Table */}
      {job?.status === 'dry_run_plan' ? (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="p-5 rounded-2xl border border-cyan-800/40 bg-cyan-950/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5 text-cyan-300">
                <ClipboardList className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold">Dry Run Strategy & Resource Estimates</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition self-start sm:self-auto"
              >
                <Play className="w-4 h-4" />
                <span>Execute This Search</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-cyan-300">Why are executed queries and discovered communities zero?</span>{' '}
              {job.dryRunExplanation || 'Dry Run Mode formulated the multi-lingual search plan and calculated resource requirements without querying external search providers (Serper/Tavily), Discord verification APIs, or Gemini AI. Zero external API calls were made, preserving 100% of your credits.'}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400">Planned Queries</div>
                <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">{job.plannedQueries?.length || job.progress?.queriesPlanned || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400">Est. API Requests</div>
                <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">{job.estimatedRequests || 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400">Est. Credit Cost</div>
                <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">{job.estimatedCredits || 0} credits</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-slate-400">External Calls Made</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">0 (Zero Spend)</div>
              </div>
            </div>
          </div>

          {/* Planned Queries Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Planned Multilingual Search Queries</h3>
              <span className="text-xs text-slate-400">{job.plannedQueries?.length || 0} queries queued</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Language</th>
                    <th className="py-3 px-4">Generated Query String</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(job.plannedQueries || []).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/20 transition">
                      <td className="py-2.5 px-4 text-slate-500">#{item.priority || idx + 1}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-sans">{item.topic}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-sans uppercase text-[11px]">{item.language}</td>
                      <td className="py-2.5 px-4 text-cyan-400 font-mono">{item.query}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter toolbar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-300">Filter By:</span>
        </div>

        <div className="flex items-center space-x-1.5">
          <label className="text-slate-400">Min Score:</label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
          >
            <option value={0}>All Scores</option>
            <option value={50}>50+ Pts</option>
            <option value={75}>75+ Pts</option>
            <option value={90}>90+ Pts (Elite)</option>
          </select>
        </div>

        <div className="flex items-center space-x-1.5">
          <label className="text-slate-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
          >
            <option value="valid">Valid Active (Default)</option>
            <option value="all">All Statuses (Include Inactive)</option>
            <option value="expired_or_revoked">Expired / Revoked</option>
            <option value="unknown">Unknown / Unverified</option>
          </select>
        </div>

        <div className="flex items-center space-x-1.5">
          <label className="text-slate-400">Language:</label>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
          >
            <option value="all">All Languages</option>
            <option value="en">English (en)</option>
            <option value="de">German (de)</option>
            <option value="es">Spanish (es)</option>
            <option value="pt">Portuguese (pt)</option>
            <option value="fr">French (fr)</option>
            <option value="ar">Arabic (ar)</option>
          </select>
        </div>

        <div className="flex items-center space-x-1.5">
          <label className="text-slate-400">Platform:</label>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
          >
            <option value="all">All Sources</option>
            <option value="reddit">Reddit</option>
            <option value="tradingview">TradingView</option>
            <option value="substack">Substack</option>
            <option value="patreon">Patreon</option>
            <option value="x_twitter">X (Twitter)</option>
            <option value="medium">Medium</option>
            <option value="quora">Quora</option>
            <option value="stocktwits">Stocktwits</option>
            <option value="trading_blogs">Trading Blogs</option>
            <option value="trading_forums">Trading Forums</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Loading results...</div>
      ) : results.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-400">
          No communities match your current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Rank / Score</th>
                <th className="py-3 px-4">Community / Server</th>
                <th className="py-3 px-4">Sources / Provenance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Language & Topics</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4 text-right">Invite Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {results.map((res, index) => {
                const communityName = res.invite.community?.name || res.invite.code;
                const members = res.invite.community?.approximateMemberCount;
                const online = res.invite.community?.approximatePresenceCount;

                return (
                  <tr key={res.invite.code} className="hover:bg-slate-800/20 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-500 font-bold">#{index + 1}</span>
                        <ScoreBadge score={res.score} breakdown={res.scoreBreakdown} />
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white truncate">{communityName}</span>
                        {(res.isSimulated || jobIsSimulated) && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                            SIMULATED
                          </span>
                        )}
                      </div>
                      {res.invite.community?.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {res.invite.community.description}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {res.sources && res.sources.length > 0 ? (
                          res.sources.map((src, sIdx) => {
                            const pName = src.sourcePlatformName || src.sourcePlatform || src.sourceDomain || 'Web';
                            return src.sourceUrl ? (
                              <a
                                key={sIdx}
                                href={src.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-[10px] border border-sky-500/20 transition"
                                title={src.contextSnippet || src.sourceUrl}
                              >
                                <span>{pName}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </a>
                            ) : (
                              <span key={sIdx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                {pName}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Direct</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          res.invite.status === 'valid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : res.invite.status === 'expired_or_revoked'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                        title={res.invite.statusReason}
                      >
                        {res.invite.status === 'valid'
                          ? 'Active Valid'
                          : res.invite.status === 'expired_or_revoked'
                          ? 'Expired / Revoked'
                          : res.invite.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                          <Globe2 className="w-2.5 h-2.5 text-purple-400" />
                          <span>{res.detectedLanguage.toUpperCase()}</span>
                        </span>
                        {res.detectedTopics.map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] border border-indigo-500/20"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            <span>{topic}</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                      {members !== null && members !== undefined ? (
                        <div className="flex items-center space-x-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{members.toLocaleString()}</span>
                          {online && <span className="text-emerald-400 text-[10px]">({online} online)</span>}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Not exposed</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      {res.invite.status === 'valid' ? (
                        <a
                          href={res.invite.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition"
                        >
                          <span>Join / Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 text-slate-500 text-xs font-semibold cursor-not-allowed border border-slate-700/50"
                          title={res.invite.statusReason || 'Invite cannot be joined'}
                        >
                          <span>Inactive Link</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Potential Community Leads Section (Without Confirmed Discord Invites) */}
      {potentialLeads.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                POTENTIAL COMMUNITY LEADS ({potentialLeads.length})
              </span>
              <span className="text-xs text-slate-400">
                Discussions discovered on public platforms without confirmed direct Discord invite links.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/20">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Platform</th>
                  <th className="py-2.5 px-4">Discussion Title / Lead</th>
                  <th className="py-2.5 px-4">Topic / Lang</th>
                  <th className="py-2.5 px-4">Status & Reason</th>
                  <th className="py-2.5 px-4 text-right">Inspect Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {potentialLeads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-slate-800/20 transition">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[11px] font-medium">
                        {lead.sourcePlatformName || lead.sourcePlatform}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-sm">
                      <div className="font-semibold text-slate-200 truncate">{lead.title}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{lead.snippet}</p>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-mono">
                          {lead.language}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px]">
                          {lead.topic}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      <span className="text-amber-400/90 font-medium">No Direct Invite</span>
                      <p className="text-[10px] text-slate-500 truncate max-w-xs">{lead.reason}</p>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <a
                        href={lead.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition"
                      >
                        <span>View Thread</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Confirmation Modal for Live Execution */}
      {showConfirmModal && job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center space-x-3 text-white">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Play className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Confirm Search Execution</h3>
                <p className="text-xs text-slate-400 font-mono">Job: {job.id}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2.5">
              <p className="leading-relaxed">
                You are about to execute live discovery for this search plan. This will consume external provider search credits and perform real-time Discord invite verification.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-slate-400">
                <div>
                  <span className="text-slate-500">Topics:</span>{' '}
                  <span className="text-slate-200 font-medium">{job.params?.topics?.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Languages:</span>{' '}
                  <span className="text-slate-200 font-medium">{job.params?.languages?.join(', ')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Est. Requests:</span>{' '}
                  <span className="text-indigo-400 font-bold font-mono">{job.estimatedRequests || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500">Est. Credits:</span>{' '}
                  <span className="text-indigo-400 font-bold font-mono">{job.estimatedCredits || 0} credits</span>
                </div>
              </div>
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                ⚠️ Daily provider limits apply. Execution respects your configured daily API budget cap.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={executing}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteLiveSearch}
                disabled={executing}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition"
              >
                {executing ? (
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

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 text-sm">Loading results...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
