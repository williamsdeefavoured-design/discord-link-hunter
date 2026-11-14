import fs from 'node:fs';
import path from 'node:path';

// Run from discord-link-hunter repository root.
const root = process.cwd();
const files = [
  'packages/db/src/repositories.ts',
  'apps/api/src/server.ts',
  'apps/web/src/app/jobs/page.tsx',
  'apps/bot/src/commands.ts',
];
const input = new Map();
for (const rel of files) {
  const loc = path.join(root, rel);
  if (!fs.existsSync(loc)) throw new Error(`Missing ${rel}. Run this script from the discord-link-hunter root.`);
  input.set(rel, fs.readFileSync(loc, 'utf8'));
}
const changes = new Map();
function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Cannot locate expected code for ${label}; NO project files changed.`);
  return source.replace(before, after);
}

// DB repository interface, local test storage and Supabase transactional removal.
{
  const rel = files[0];
  let src = input.get(rel);
  src = replaceOnce(src,
    '  getJob(id: string): Promise<SearchJob | null>;',
    '  getJob(id: string): Promise<SearchJob | null>;\n  deleteJob(id: string): Promise<boolean>;',
    'repository interface');
  const memAnchor = `  async getJob(id: string): Promise<SearchJob | null> {\n    return this.jobs.get(id) || null;\n  }`;
  const memReplace = `${memAnchor}\n\n  async deleteJob(id: string): Promise<boolean> {\n    const job = this.jobs.get(id);\n    if (!job) return false;\n    if (job.status === 'queued' || job.status === 'running') {\n      throw new Error('Cannot delete a queued or running job; wait for completion or cancel it first.');\n    }\n    this.jobs.delete(id);\n    this.jobResults.delete(id);\n    this.persistToFile();\n    return true;\n  }`;
  src = replaceOnce(src, memAnchor, memReplace, 'InMemoryRepository deleteJob');
  const pgStart = src.indexOf('export class PostgresRepository');
  if (pgStart < 0) throw new Error('Missing PostgresRepository');
  const pgAnchor = '  async getJob(id: string): Promise<SearchJob | null> {';
  const pgAt = src.indexOf(pgAnchor, pgStart);
  if (pgAt < 0) throw new Error('Cannot locate Postgres getJob');
  if (!src.slice(pgStart, pgAt).includes('async deleteJob(')) {
    const method = `  /** Permanently delete a finished job, its results, and exclusively owned\n   * invite/source/community data. Shared cross-job records are preserved. */\n  async deleteJob(id: string): Promise<boolean> {\n    const db = getDbClient();\n    if (!db) throw new Error('Database client unavailable');\n\n    return db.transaction(async (tx) => {\n      const jobs = await tx.select({ status: schema.searchJobs.status })\n        .from(schema.searchJobs).where(eq(schema.searchJobs.id, id)).limit(1);\n      if (jobs.length === 0) return false;\n      if (jobs[0].status === 'queued' || jobs[0].status === 'running') {\n        throw new Error('Cannot delete a queued or running job; wait for completion or cancel it first.');\n      }\n\n      const jobLinks = await tx.select({ code: schema.searchJobResults.inviteCode })\n        .from(schema.searchJobResults).where(eq(schema.searchJobResults.jobId, id));\n      const inviteCodes = [...new Set(jobLinks.map((row) => row.code))];\n      const sourceIds = new Set<string>();\n      const communityIds = new Set<string>();\n\n      if (inviteCodes.length > 0) {\n        const references = await tx.select({ sourceId: schema.inviteSources.sourceId })\n          .from(schema.inviteSources).where(inArray(schema.inviteSources.inviteCode, inviteCodes));\n        for (const row of references) sourceIds.add(row.sourceId);\n        const metadata = await tx.select({ communityId: schema.invites.communityId })\n          .from(schema.invites).where(inArray(schema.invites.code, inviteCodes));\n        for (const row of metadata) {\n          if (row.communityId) communityIds.add(row.communityId);\n        }\n      }\n\n      // The existing ON DELETE CASCADE removes search_job_results automatically.\n      await tx.delete(schema.searchJobs).where(eq(schema.searchJobs.id, id));\n\n      for (const code of inviteCodes) {\n        const stillUsed = await tx.select({ code: schema.searchJobResults.inviteCode })\n          .from(schema.searchJobResults).where(eq(schema.searchJobResults.inviteCode, code)).limit(1);\n        if (stillUsed.length === 0) {\n          // invite_sources and verification_history cascade with the invite.\n          await tx.delete(schema.invites).where(eq(schema.invites.code, code));\n        }\n      }\n      for (const sourceId of sourceIds) {\n        const stillUsed = await tx.select({ id: schema.inviteSources.sourceId })\n          .from(schema.inviteSources).where(eq(schema.inviteSources.sourceId, sourceId)).limit(1);\n        if (stillUsed.length === 0) {\n          await tx.delete(schema.sources).where(eq(schema.sources.id, sourceId));\n        }\n      }\n      for (const communityId of communityIds) {\n        const stillUsed = await tx.select({ id: schema.invites.code })\n          .from(schema.invites).where(eq(schema.invites.communityId, communityId)).limit(1);\n        if (stillUsed.length === 0) {\n          await tx.delete(schema.communities).where(eq(schema.communities.id, communityId));\n        }\n      }\n      // provider_usage is aggregate data with no job_id; do not erase shared quotas.\n      return true;\n    });\n  }\n\n`;
    src = src.slice(0, pgAt) + method + src.slice(pgAt);
  }
  changes.set(rel, src);
}

// Authenticated delete endpoint. Confirm exact job ID, prohibit in-progress deletion.
{
  const rel = files[1];
  let src = input.get(rel);
  const anchor = '  // Cancel job\n';
  if (!src.includes('app.delete(\'/api/jobs/:id\'')) {
    if (!src.includes(anchor)) throw new Error('Cannot locate cancel-job route anchor.');
    const route = `  // Irreversible job deletion: authenticated by the existing API request hook.\n  app.delete('/api/jobs/:id', async (req, reply) => {\n    const { id } = req.params as { id: string };\n    const body = (req.body || {}) as { confirm?: boolean; jobId?: string };\n    if (!id || id.length > 64 || body.confirm !== true || body.jobId !== id) {\n      return reply.status(400).send({ error: 'Confirm deletion by supplying { confirm: true, jobId: <exact job ID> }.' });\n    }\n    const job = await repo.getJob(id);\n    if (!job) return reply.status(404).send({ error: 'Job not found or already deleted.' });\n    if (job.status === 'queued' || job.status === 'running') {\n      return reply.status(409).send({ error: 'Finish or cancel the running job before deleting it.' });\n    }\n    try {\n      const deleted = await repo.deleteJob(id);\n      if (!deleted) return reply.status(404).send({ error: 'Job not found or already deleted.' });\n      return reply.status(200).send({ deleted: true, jobId: id });\n    } catch (error: unknown) {\n      const message = error instanceof Error ? error.message : 'Delete failed';\n      if (message.startsWith('Cannot delete a queued or running job')) {\n        return reply.status(409).send({ error: message });\n      }\n      req.log.error({ err: error }, 'Failed to delete job');\n      return reply.status(500).send({ error: 'Unable to delete job. No deletion was confirmed.' });\n    }\n  });\n\n`;
    src = src.replace(anchor, route + anchor);
  }
  changes.set(rel, src);
}

// Jobs page: show archived simulations on demand and confirm permanent deletion.
{
  const rel = files[2];
  let src = input.get(rel);
  src = replaceOnce(src,
    '  RefreshCw,\n',
    '  RefreshCw,\n  Trash2,\n  Eye,\n',
    'Jobs icons');
  const stateAnchor = '  const [jobs, setJobs] = useState<SearchJob[]>([]);';
  src = replaceOnce(src, stateAnchor,
    `${stateAnchor}\n  const [showOldJobs, setShowOldJobs] = useState(false);\n  const [deleteTarget, setDeleteTarget] = useState<SearchJob | null>(null);\n  const [typedJobId, setTypedJobId] = useState('');\n  const [deleting, setDeleting] = useState(false);`,
    'Jobs state');
  src = src.replace("apiFetch<{ jobs: SearchJob[] }>('/api/jobs')", "apiFetch<{ jobs: SearchJob[] }>('/api/jobs?limit=300')");
  src = src.replace('setJobs(result.data.jobs.filter((job) => job.mode === \'live\' && !job.isSimulated));', 'setJobs(result.data.jobs);');
  const executeAnchor = '  const getStatusBadge = (status: SearchJob[\'status\']) => {';
  if (!src.includes('const handlePermanentDelete = async')) {
    if (!src.includes(executeAnchor)) throw new Error('Cannot find status-badge anchor for delete handler');
    const handler = `  const visibleJobs = showOldJobs ? jobs : jobs.filter((job) => job.mode === 'live' && !job.isSimulated);\n\n  const handlePermanentDelete = async () => {\n    if (!deleteTarget || typedJobId !== deleteTarget.id || deleting) return;\n    setDeleting(true);\n    try {\n      const res = await apiFetch<{ deleted: boolean }>(\`/api/jobs/\${encodeURIComponent(deleteTarget.id)}\`, {\n        method: 'DELETE',\n        body: JSON.stringify({ confirm: true, jobId: deleteTarget.id }),\n      });\n      if (!res.ok || !res.data?.deleted) {\n        setErrorMessage(res.error || 'Permanent deletion failed.');\n        return;\n      }\n      setJobs((existing) => existing.filter((job) => job.id !== deleteTarget.id));\n      setErrorMessage(null);\n      setDeleteTarget(null);\n      setTypedJobId('');\n      await fetchJobs();\n    } finally {\n      setDeleting(false);\n    }\n  };\n\n`;
    src = src.replace(executeAnchor, handler + executeAnchor);
  }
  src = replaceOnce(src,
    `        <button\n          onClick={() => {\n            setRefreshing(true);`,
    `        <div className="flex items-center gap-3">\n          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">\n            <input type="checkbox" checked={showOldJobs} onChange={(e) => setShowOldJobs(e.target.checked)} className="accent-teal-400" />\n            <Eye className="w-3.5 h-3.5" /> Show old test jobs\n          </label>\n        <button\n          onClick={() => {\n            setRefreshing(true);`,
    'show old jobs toggle');
  // Close the added wrapper after refresh button's final closing before header closing.
  const refreshEnding = `          title="Refresh Jobs"\n        >\n          <RefreshCw className={\`w-4 h-4 \${refreshing ? 'animate-spin' : ''}\`} />\n        </button>\n      </div>`;
  if (src.includes(refreshEnding)) {
    src = src.replace(refreshEnding, refreshEnding.replace('        </button>\n      </div>', '        </button>\n        </div>\n      </div>'));
  } else if (!src.includes('        </button>\n        </div>\n      </div>')) {
    throw new Error('Cannot find refresh button header ending');
  }
  src = replaceOnce(src, ') : jobs.length === 0 ? (', ') : visibleJobs.length === 0 ? (', 'Jobs empty state');
  src = replaceOnce(src, '{jobs.map((job) => {', '{visibleJobs.map((job) => {', 'Jobs list');
  const viewLink = `                    <Link\n                      href={\`/results?job=\${job.id}\`}`;
  if (!src.includes('onClick={() => { setDeleteTarget(job); setTypedJobId(\'\'); }}')) {
    if (!src.includes(viewLink)) throw new Error('Cannot find View Results link');
    src = src.replace(viewLink, `                    {job.status !== 'running' && job.status !== 'queued' && (\n                      <button\n                        type="button"\n                        onClick={() => { setDeleteTarget(job); setTypedJobId(''); }}\n                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-300"\n                        title="Permanently delete this job and its unshared data"\n                      >\n                        <Trash2 className="w-3.5 h-3.5" /> Delete\n                      </button>\n                    )}\n${viewLink}`);
  }
  // Add confirmation dialog as a sibling inside page root, before its final closing root div.
  if (!src.includes('Permanently delete this search job?')) {
    const end = src.lastIndexOf('    </div>\n  );');
    if (end < 0) throw new Error('Cannot find JobsPage return closing tag');
    const modal = `      {deleteTarget && (\n        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">\n          <div role="dialog" aria-modal="true" aria-labelledby="delete-job-heading" className="w-full max-w-md rounded-xl border border-rose-500/30 bg-[#101a25] p-6 shadow-2xl">\n            <h2 id="delete-job-heading" className="text-lg font-semibold text-white">Permanently delete this search job?</h2>\n            <p className="mt-2 text-sm leading-6 text-slate-300">This removes the job, saved results, and unshared associated invite records from Supabase. This cannot be undone.</p>\n            <p className="mt-3 break-all rounded bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-300">{deleteTarget.id}</p>\n            <label className="mt-4 block text-sm text-slate-300" htmlFor="job-delete-confirm">Type the exact job ID to confirm</label>\n            <input id="job-delete-confirm" autoFocus value={typedJobId} onChange={(e) => setTypedJobId(e.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="job-..." />\n            <div className="mt-5 flex justify-end gap-3">\n              <button type="button" disabled={deleting} onClick={() => { setDeleteTarget(null); setTypedJobId(''); }} className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200">Cancel</button>\n              <button type="button" disabled={deleting || typedJobId !== deleteTarget.id} onClick={handlePermanentDelete} className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">\n                <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete permanently'}\n              </button>\n            </div>\n          </div>\n        </div>\n      )}\n`;
    src = src.slice(0, end) + modal + src.slice(end);
  }
  changes.set(rel, src);
}

// Discord results: avoid duplicate Supabase result queries on /results and button paging.
{
  const rel = files[3];
  let src = input.get(rel);
  const oldResults = `    const [results, job] = await Promise.all([\n      repo.getJobResults(jobId),\n      repo.getJob(jobId),\n    ]);`;
  // Avoid backtick escaping hazards: use a simple non-template message.
  if (src.includes(oldResults)) {
    src = src.replace(oldResults, `    const job = await repo.getJob(jobId);\n    if (!job) {\n      await interaction.editReply({ content: '❌ Job not found or permanently deleted: ' + jobId });\n      return;\n    }\n    const results = job.results || [];`);
  }
  // Button handler does the same redundant query, but keep its response/error flow.
  const oldButton = `    const [allResults, job] = await Promise.all([\n      repo.getJobResults(jobId),\n      repo.getJob(jobId),\n    ]);`;
  if (src.includes(oldButton)) {
    src = src.replace(oldButton, `    const job = await repo.getJob(jobId);\n    const allResults = job?.results || [];`);
  }
  // Discord embed limits can reject large result fields and cause an interaction error.
  if (!src.includes('const trimForEmbed =')) {
    const before = "  const embed = new EmbedBuilder()\n    .setColor(0x5865f2)";
    const after = "  const trimForEmbed = (value: string, length: number) => value.length <= length ? value : value.slice(0, length - 1) + '…';\n  const embed = new EmbedBuilder()\n    .setColor(0x5865f2)";
    if (src.includes(before)) src = src.replace(before, after);
    src = src.replace('    .setTitle(title)\n    .setDescription(description)', '    .setTitle(trimForEmbed(title, 256))\n    .setDescription(trimForEmbed(description, 4096))');
    src = src.replace('      name: `#${rank} • Score ${res.score}/100: ${serverName}`,', '      name: trimForEmbed(`#${rank} • Score ${res.score}/100: ${serverName}`, 256),');
    src = src.replace('        `*${explanations}*`,', '        trimForEmbed(`*${explanations}*`, 900),');
  }
  changes.set(rel, src);
}

const modified = files.filter((file) => changes.get(file) !== input.get(file));
const snapshot = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(root, '.linkhunter-delete-backups', snapshot);
// Preflight complete. Backups before any project files are touched.
for (const rel of modified) {
  const destination = path.join(backup, rel);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, input.get(rel), 'utf8');
}
for (const rel of modified) {
  fs.writeFileSync(path.join(root, rel), changes.get(rel), 'utf8');
  console.log('Updated ' + rel);
}
console.log(`Original files backed up to ${backup}`);
console.log('Run: npm run typecheck && npm test');
