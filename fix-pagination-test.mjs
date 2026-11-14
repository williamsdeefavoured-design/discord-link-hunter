// Targeted test-only change for the pagination data-fetch contract.
// Run from the discord-link-hunter project root: node fix-pagination-test.mjs
import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve(process.cwd(), 'tests', 'pagination-interaction.test.ts');
if (!fs.existsSync(file)) { console.error('Not in project root: cannot find '+file); process.exitCode=1; }
else {
  const input=fs.readFileSync(file, 'utf8');
  const oldBlock=`    const origGetResults = mockRepo.getJobResults.bind(mockRepo);
    mockRepo.getJobResults = async (id: string) => {
      callOrder.push('getJobResults');
      return origGetResults(id);
    };`;
  const newBlock=`    const origGetJob = mockRepo.getJob.bind(mockRepo);
    mockRepo.getJob = async (id: string) => {
      callOrder.push('getJob');
      return origGetJob(id);
    };`;
  const oldCheck="expect(callOrder[1]).toBe('getJobResults');";
  const newCheck="expect(callOrder[1]).toBe('getJob');";
  if (input.includes(newBlock) && input.includes(newCheck)) {console.log('Pagination test is already fixed.');}
  else if (input.split(oldBlock).length !== 2 || input.split(oldCheck).length !== 2) {
    console.error('Expected old test lines not found. No file changed.');process.exitCode=1;
  } else {
    const fixed=input.replace(oldBlock,newBlock).replace(oldCheck,newCheck);
    const backup=file+'.before-pagination-test-fix.bak';
    fs.copyFileSync(file, backup);
    fs.writeFileSync(file, fixed, 'utf8');
    console.log('Updated 1 test file. Backup: '+backup);
    console.log('Run: npx vitest run tests/pagination-interaction.test.ts');
  }
}
