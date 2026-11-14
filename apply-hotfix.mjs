// Discord Link Hunter — surgical hotfix, no external dependencies.
// Run from the project root: node apply-hotfix.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'packages/research/src/serper.ts',
  'apps/bot/src/commands.ts',
  'apps/web/src/app/discover/page.tsx',
];
const original = new Map();
for (const rel of files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Cannot find ${rel}. Run from the discord-link-hunter project root.`);
  original.set(rel, fs.readFileSync(full, 'utf8'));
}
function requireReplace(src, before, after, label) {
  if (src.includes(after)) return src;
  if (!src.includes(before)) throw new Error(`Unexpected file structure at: ${label}. No files changed.`);
  return src.replace(before, after);
}
const changed = new Map();
{
  const rel = files[0];
  let s = original.get(rel);
  s = requireReplace(s,
    'const limit = Math.min(options.limit || 10, 100);',
    `// The community result limit is NOT Serper's per-query Google page size.\n    const limit = Math.max(1, Math.min(options.limit || 10, 10));`, rel);
  s = s.replace("pt: { gl: 'br', hl: 'pt-br' }", "pt: { gl: 'br', hl: 'pt' }");
  const oldBlock = `      if (!res.ok) {\n        return {\n          provider: 'serper',\n          query,\n          items: [],\n          statusCode,\n          durationMs,\n          error: \`Serper HTTP error \${statusCode}\`,\n        };\n      }`;
  const newBlock = `      if (!res.ok) {\n        let reason = '';\n        try {\n          const body = typeof res.text === 'function' ? await res.text() : '';\n          const payload = JSON.parse(body);\n          const value = payload?.message ?? payload?.error;\n          reason = typeof value === 'string' ? value.slice(0, 180) : '';\n        } catch {\n          // Provider error body may be unavailable.\n        }\n        return {\n          provider: 'serper',\n          query,\n          items: [],\n          statusCode,\n          durationMs,\n          error: \`Serper HTTP error \${statusCode}\${reason ? \`: \${reason}\` : ''}\`,\n        };\n      }`;
  s = requireReplace(s, oldBlock, newBlock, rel+' HTTP error');
  changed.set(rel,s);
}
{
  const rel=files[1];
  let s=original.get(rel);
  const start=s.indexOf("  new SlashCommandBuilder()\n    .setName('deepsearch')");
  if(start>=0){
    const end=s.indexOf("  new SlashCommandBuilder()\n    .setName('verify')", start);
    if(end<0) throw new Error(`Unexpected bot command structure in ${rel}; no files changed.`);
    s=s.slice(0,start)+"  // Depth 2 remains available internally, but is hidden from guild slash commands.\n\n"+s.slice(end);
  }
  changed.set(rel,s);
}
{
  const rel=files[2];
  let s=original.get(rel);
  s=requireReplace(s,'const [depth, setDepth] = useState(1);', 'const depth = 1; // Stable standard search only.',rel);
  const start=s.indexOf('          <div className="space-y-2">\n            <label htmlFor="depth"');
  if(start>=0){
    const end=s.indexOf('\n          </div>', start);
    if(end<0) throw new Error(`Unexpected search-depth form structure in ${rel}; no files changed.`);
    s=s.slice(0,start)+'          {/* Depth 2 hidden pending reliability validation */}'+s.slice(end+'\n          </div>'.length);
    s=s.replace('<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">','<div className="grid grid-cols-1 gap-4">');
  }
  changed.set(rel,s);
}
// All transformations succeeded before writing any file. Save backups first.
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(root, '.linkhunter-hotfix-backups',stamp);
let count=0;
for(const rel of files){
  if(changed.get(rel)!==original.get(rel)){
    const f=path.join(backup,rel);
    fs.mkdirSync(path.dirname(f),{recursive:true});
    fs.writeFileSync(f,original.get(rel));
    count++;
  }
}
for(const rel of files){
  if(changed.get(rel)!==original.get(rel)){
    fs.writeFileSync(path.join(root,rel),changed.get(rel));
    console.log('Updated '+rel);
  }
}
console.log(`${count} file(s) updated. Backups: ${backup}`);
console.log('Next: npm run typecheck; npm test');
console.log('Then: npm run register --workspace=@discord-link-hunter/bot');
