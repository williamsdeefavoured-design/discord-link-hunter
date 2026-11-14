'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Activity, Compass, Database, Globe2, Layers3, ShieldCheck, Clock3 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { SearchJob } from '@discord-link-hunter/core';

type Health = { database?: { connected?: boolean }; providers?: { serper?: boolean; tavily?: boolean } };

const label = (status: string) => status.replace(/_/g, ' ');

export default function OverviewPage() {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobsError, setJobsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [jobsResponse, healthResponse] = await Promise.all([
        apiFetch<{ jobs: SearchJob[] }>('/api/jobs?limit=50'),
        apiFetch<Health>('/health'),
      ]);
      if (!active) return;
      if (jobsResponse.ok && jobsResponse.data?.jobs) {
        setJobs(jobsResponse.data.jobs.filter((job) => job.mode === 'live' && !job.isSimulated));
        setJobsError(false);
      } else setJobsError(true);
      if (healthResponse.ok && healthResponse.data) setHealth(healthResponse.data);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const completed = jobs.filter((job) => job.status === 'completed').length;
  const live = jobs.filter((job) => job.mode === 'live').length;
  const latest = jobs[0];
  const metrics = [
    { title: 'Recent jobs', number: loading || jobsError ? '—' : String(jobs.length), detail: 'Last 50 records', icon: Layers3 },
    { title: 'Completed', number: loading || jobsError ? '—' : String(completed), detail: 'Successful job records', icon: ShieldCheck },
    { title: 'Live searches', number: loading || jobsError ? '—' : String(live), detail: 'Among recent jobs', icon: Globe2 },
    { title: 'Database', number: health ? (health.database?.connected ? 'Online' : 'Offline') : '—', detail: 'PostgreSQL connection', icon: Database },
  ];

  return (
    <div className="space-y-7 md:space-y-9">
      <div className="workspace-hero flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#293849] pb-7 md:pb-9 px-2 md:px-5 pt-3 md:pt-5">
        <div className="space-y-4 max-w-[760px]">
          <div className="workspace-kicker flex items-center gap-3"><span className="w-7 h-px bg-[#82b6c6]" /> Discovery operations / v2.1</div>
          <h1 className="workspace-heading">Find the signal.<br /><span className="text-[#8eafb8]">Verify the source.</span></h1>
          <p className="workspace-lede text-sm md:text-[15px]">Research public trading communities across social, publishing and discussion platforms. Inspect the evidence behind every result before you act.</p>
          <div className="pt-1 flex flex-wrap gap-3">
            <Link href="/discover" className="workspace-button"><Compass className="w-4 h-4" /> New discovery <ArrowUpRight className="w-4 h-4" /></Link>
            <Link href="/jobs" className="workspace-button workspace-button-secondary">Review jobs <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
        <div className="lg:w-[290px] workspace-panel p-5 space-y-4">
          <div className="flex items-center justify-between"><span className="workspace-kicker">Research stack</span><Activity className="w-4 h-4 text-[#82b0bb]" /></div>
          <div className="space-y-3 text-[12px] text-[#aabac8]">
            <div className="flex justify-between"><span>Search providers</span><span className="text-[#e5f0f5]">Serper / Tavily</span></div>
            <div className="workspace-divider" />
            <div className="flex justify-between"><span>Supported languages</span><span className="text-[#e5f0f5]">06</span></div>
            <div className="workspace-divider" />
            <div className="flex justify-between"><span>Public source categories</span><span className="text-[#e5f0f5]">10</span></div>
          </div>
          <p className="text-[11px] text-[#849bad] leading-relaxed">Verification confirms invitation status, not a community’s trustworthiness or financial advice quality.</p>
        </div>
      </div>

      <section className="space-y-3" aria-label="Recent job metrics">
        <div className="flex items-center justify-between gap-3"><span className="workspace-kicker">Operational snapshot</span><span className="workspace-meta">Live records · no sample metrics</span></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map(({ title, number, detail, icon: Icon }) => (
            <div className="workspace-card p-4 md:p-5" key={title}>
              <div className="flex items-center justify-between gap-2 text-[#9fb2c3]"><span className="text-[12px]">{title}</span><Icon className="w-4 h-4" strokeWidth={1.6} /></div>
              <div className="workspace-stat-number mt-4">{number}</div><div className="workspace-meta mt-1">{detail}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4">
        <section className="workspace-panel overflow-hidden">
          <div className="flex justify-between items-center px-5 md:px-6 py-5 border-b border-[#293849]">
            <div><div className="workspace-kicker">Recent activity</div><h2 className="text-[17px] font-semibold mt-1 text-[#eaf1f6]">Search jobs</h2></div>
            <Link className="text-[12px] text-[#93c4d4] hover:text-white inline-flex items-center gap-1" href="/jobs">All jobs <ArrowUpRight className="w-3.5 h-3.5" /></Link>
          </div>
          {jobsError ? (
            <div className="px-6 py-10 text-[#c4aa8d] text-sm">Could not load job data. Check the API connection in System.</div>
          ) : loading ? (
            <div className="px-6 py-10 text-[#8e9cae] text-sm">Loading recent jobs…</div>
          ) : jobs.length === 0 ? (
            <div className="px-6 py-10 text-[#95aabc] text-sm">No live research jobs yet. Launch a discovery to get started.</div>
          ) : (
            <div className="divide-y divide-[#283749]">
              {jobs.slice(0, 5).map((job) => (
                <Link key={job.id} href={`/results?job=${encodeURIComponent(job.id)}`} className="flex gap-3 items-center justify-between px-5 md:px-6 py-4 hover:bg-[#1c2b3a] transition-colors">
                  <div className="min-w-0"><div className="text-[12px] font-mono text-[#d8e4ec] truncate">{job.id}</div><div className="workspace-meta mt-1">{job.mode.toUpperCase()} · {job.params?.topics?.join(', ') || 'General research'}</div></div>
                  <div className="flex gap-2 items-center shrink-0"><span className="text-[11px] text-[#93bdc7] capitalize">{label(job.status)}</span><ArrowUpRight className="w-4 h-4 text-[#82a4b2]" /></div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="workspace-panel p-5 md:p-6 flex flex-col justify-between gap-7">
          <div><span className="workspace-kicker">Workflow / 03 stages</span><h2 className="text-[17px] font-semibold text-[#eaf1f6] mt-2">Research with evidence</h2></div>
          <div className="space-y-5">
            {[
              ['01','Discover','Search indexed public platforms and collect candidate invites.'],
              ['02','Validate','Confirm invite status and retain source provenance.'],
              ['03','Review','Compare relevance scores and export findings.'],
            ].map(([num,title,desc]) => (
              <div className="flex items-start gap-4" key={num}>
                <span className="font-mono text-[12px] text-[#83b4c6] pt-0.5">{num}</span>
                <div className="flex-1"><div className="text-[13px] text-[#e2eaf0] font-semibold">{title}</div><p className="text-[12px] leading-relaxed text-[#92a6b8] mt-1">{desc}</p></div>
              </div>
            ))}
          </div>
          <Link className="inline-flex items-center gap-1 text-[12px] text-[#9dc9d8] hover:text-[#fff]" href="/results">Open results workspace <ArrowRight className="w-4 h-4" /></Link>
        </section>
      </div>
    </div>
  );
}
