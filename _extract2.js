const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');
const lines = d.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('screeding-before-start-of-work')) {
    const idx = lines[i].indexOf('screeding-before');
    // Get a much larger chunk to capture all 13 sections
    const chunk = lines[i].substring(idx, idx + 80000);
    // Find the end marker - look for the sections array definition end
    console.log(chunk);
    break;
  }
}
