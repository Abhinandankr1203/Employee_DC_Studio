const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');
const lines = d.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('screeding-before-start-of-work')) {
    // Extract a large chunk around quality checklist data
    const idx = lines[i].indexOf('screeding-before');
    // Find surrounding context - look for the quality checklist array definitions
    const chunk = lines[i].substring(idx, idx + 20000);
    console.log(chunk);
    break;
  }
}
