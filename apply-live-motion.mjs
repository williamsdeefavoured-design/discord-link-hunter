// Link Hunter — Live-only UX + subtle home animation.
// Run from the repo root: node apply-live-motion.mjs
// No dependencies, no secrets, no database changes.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const paths = [
  'packages/config/src/index.ts',
  'packages/db/src/job-queue.ts',
  'apps/api/src/server.ts',
  'apps/bot/src/commands.ts',
  'apps/web/src/app/discover/page.tsx',
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/jobs/page.tsx',
  'apps/web/src/app/globals.css',
];
const oldFiles = new Map();
for (const rel of paths) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) throw new Error(`Missing ${rel}. Run inside your discord-link-hunter project root.`);
  oldFiles.set(rel, fs.readFileSync(f, 'utf8'));
}
const changed = new Map();
function apply(rel, fn) { changed.set(rel, fn(oldFiles.get(rel))); }
function replaceOne(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Expected code not found in ${label}. No files were changed.`);
  return text.replace(from, to);
}

// Config: preserve Mock Mode schema for Vitest, but force the runtime to Live in normal use.
apply('packages/config/src/index.ts', (src) => {
  return replaceOne(
    src,
    '    _config = parsed.data;',
    `    // Keep the mock adapter for automated tests only.\n    // A stale SEARCH_MODE=mock in .env cannot enable simulated discoveries in normal use.\n    const automatedTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';\n    _config = automatedTest ? parsed.data : { ...parsed.data, SEARCH_MODE: 'live' };`,
    'packages/config/src/index.ts'
  );
});

apply('packages/db/src/job-queue.ts', (src) => {
  return replaceOne(
    src,
    "    const mode = forceMode || (config.SEARCH_MODE === 'live' ? 'live' : 'mock');",
    `    const automatedTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';\n    if (!automatedTest && forceMode === 'mock') {\n      throw new Error('Simulated discoveries are disabled outside automated tests.');\n    }\n    const mode: 'mock' | 'live' = automatedTest ? (forceMode ?? 'mock') : 'live';`,
    'packages/db/src/job-queue.ts'
  );
});

apply('apps/api/src/server.ts', (src) => {
  src = replaceOne(src,
    `    const params = parsed.data;\n    const job = await queue.createJob(params, 'api-user', params.mode);`,
    `    const params = parsed.data;\n    const automatedTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';\n    if (params.mode === 'mock' && !automatedTest) {\n      return reply.status(400).send({ error: 'Simulated discovery mode is disabled.' });\n    }\n    const job = await queue.createJob(params, 'api-user', automatedTest ? params.mode : 'live');`,
    'apps/api/src/server.ts create-job'
  );
  // Previously generated mock dry-run plans remain in storage, but cannot be executed in real environments.
  const before = `    if (!job) {\n      return reply.status(404).send({ error: 'Job not found' });\n    }\n\n    // Check usage limits if in live mode`;
  const after = `    if (!job) {\n      return reply.status(404).send({ error: 'Job not found' });\n    }\n    if (job.mode === 'mock' && process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {\n      return reply.status(400).send({ error: 'Historical simulated plans cannot be executed in Live Mode.' });\n    }\n\n    // Check usage limits if in live mode`;
  src = replaceOne(src, before, after, 'apps/api/src/server.ts execute-job');
  return src;
});

apply('apps/bot/src/commands.ts', (src) => {
  // The former /deepsearch command may already have been removed by the safe hotfix.
  const marker = "\n    .addStringOption((opt) =>\n      opt\n        .setName('mode')";
  while (src.includes(marker)) {
    const begin = src.indexOf(marker);
    const endMarker = '\n    ),';
    const end = src.indexOf(endMarker, begin);
    if (end < 0) throw new Error('Unable to safely remove Discord mode option. No files were changed.');
    // Replace the final chained option with a command-list separator comma.
    src = src.slice(0, begin) + ',' + src.slice(end + endMarker.length);
  }
  const start = src.indexOf('    // Explicit per-command mode.');
  if (start >= 0) {
    const end = src.indexOf('    // Create job using', start);
    if (end < 0) throw new Error('Discord mode handler structure unexpected. No files were changed.');
    src = src.slice(0, start) + "    // User-facing searches are always Live; test fixtures remain in Vitest.\n    const mode = 'live' as const;\n\n" + src.slice(end);
  } else if (!src.includes("const mode = 'live' as const;")) {
    throw new Error('Discord mode handling changed. No files were changed.');
  }
  src = src.replace('value: `\\`${config.SEARCH_MODE}\\``', 'value: `\\`live\\``');
  // Some versions use an ordinary interpolated template rather than an escaped string.
  src = src.replace('value: `\`${config.SEARCH_MODE}\``', 'value: `\`live\``');
  return src;
});

apply('apps/web/src/app/discover/page.tsx', (src) => {
  src = replaceOne(src,
    "  const [mode, setMode] = useState<'mock' | 'live'>('mock');",
    "  const mode = 'live' as const;",
    'apps/web/src/app/discover/page.tsx mode'
  );
  src = replaceOne(src,
    '  const [dryRun, setDryRun] = useState(false);',
    '  const dryRun = false;',
    'apps/web/src/app/discover/page.tsx dry-run'
  );
  const modeStart = src.indexOf('        {/* Mode Selector */}');
  if (modeStart >= 0) {
    const modeEnd = src.indexOf('        {/* Topic Selector */}', modeStart);
    if (modeEnd < 0) throw new Error('Discover form mode selector structure unexpected. No files were changed.');
    src = src.slice(0, modeStart) +
      `        <div role="note" className="rounded-lg border border-[#31545c] bg-[#132b32] px-4 py-3 text-xs leading-relaxed text-[#b6d7d8]">\n          <strong className="text-[#d5eeee]">Live discovery enabled.</strong> Searches use Serper / Tavily research requests and the configured provider limits.\n        </div>\n\n` + src.slice(modeEnd);
  }
  const dryStart = src.indexOf('        {/* Dry run option */}');
  if (dryStart >= 0) {
    const dryEnd = src.indexOf('        {statusMessage && (', dryStart);
    if (dryEnd < 0) throw new Error('Discover form dry-run checkbox structure unexpected. No files were changed.');
    src = src.slice(0, dryStart) + src.slice(dryEnd);
  }
  return src;
});

apply('apps/web/src/app/page.tsx', (src) => {
  src = replaceOne(src,
    'setJobs(jobsResponse.data.jobs);',
    "setJobs(jobsResponse.data.jobs.filter((job) => job.mode === 'live' && !job.isSimulated));",
    'apps/web/src/app/page.tsx history'
  );
  src = src.replace('No jobs yet. Start with a Mock search to check the pipeline.', 'No live research jobs yet. Launch a discovery to get started.');
  const heroNeedle = 'flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#293849] pb-7 md:pb-9';
  if (!src.includes('workspace-hero')) {
    if (!src.includes(heroNeedle)) throw new Error('Homepage hero structure unexpected. No files were changed.');
    src = src.replace(heroNeedle, `workspace-hero ${heroNeedle} px-2 md:px-5 pt-3 md:pt-5`);
  }
  return src;
});

apply('apps/web/src/app/jobs/page.tsx', (src) => replaceOne(src,
  'setJobs(result.data.jobs);',
  "setJobs(result.data.jobs.filter((job) => job.mode === 'live' && !job.isSimulated));",
  'apps/web/src/app/jobs/page.tsx'
));

apply('apps/web/src/app/globals.css', (src) => {
  if (src.includes('@keyframes hunter-aurora-drift')) return src;
  // Animation is deliberately small, self-contained, and honors reduced motion.
  return src + `\n\n/* Portfolio polish: slow ambient motion confined to the homepage hero. */\n.workspace-hero {\n  position: relative;\n  isolation: isolate;\n}\n.workspace-hero::before {\n  content: '';\n  position: absolute;\n  inset: -22px -2% 4px 25%;\n  z-index: -1;\n  pointer-events: none;\n  background:\n    radial-gradient(ellipse at 65% 42%, rgba(74, 150, 176, 0.22), transparent 58%),\n    radial-gradient(ellipse at 31% 70%, rgba(82, 182, 161, 0.11), transparent 60%);\n  filter: blur(16px);\n  transform-origin: 60% 60%;\n  animation: hunter-aurora-drift 14s ease-in-out infinite alternate;\n}\n.workspace-hero::after {\n  content: '';\n  position: absolute;\n  right: 11%;\n  top: 18%;\n  width: 9px;\n  height: 9px;\n  border-radius: 50%;\n  background: rgba(135, 211, 218, 0.8);\n  box-shadow: 0 0 22px 7px rgba(106, 185, 194, 0.18);\n  pointer-events: none;\n  animation: hunter-ambient-float 8s ease-in-out infinite;\n}\n@keyframes hunter-aurora-drift {\n  0% { opacity: 0.55; transform: translate3d(-8px, 0, 0) scale(0.98); }\n  50% { opacity: 0.82; }\n  100% { opacity: 0.65; transform: translate3d(14px, -10px, 0) scale(1.045); }\n}\n@keyframes hunter-ambient-float {\n  0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.35; }\n  50% { transform: translate3d(14px, -18px, 0); opacity: 0.9; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .workspace-hero::before, .workspace-hero::after { animation: none; }\n}\n`;
});

// All transformations are validated before touching disk.
const changedPaths = paths.filter(rel => changed.get(rel) !== oldFiles.get(rel));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(root, '.linkhunter-live-motion-backups', stamp);
for (const rel of changedPaths) {
  const dest = path.join(backup, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, oldFiles.get(rel), 'utf8');
}
for (const rel of changedPaths) {
  fs.writeFileSync(path.join(root, rel), changed.get(rel), 'utf8');
  console.log(`Updated ${rel}`);
}
console.log(`\nUpdated ${changedPaths.length} files. Original file backups saved at ${backup}`);
console.log('Next: npm run typecheck && npm test');
console.log('Then re-register Discord commands and restart the services.');
