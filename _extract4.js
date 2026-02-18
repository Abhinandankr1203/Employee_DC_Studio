const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');
const lines = d.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('screeding-before-start-of-work')) {
    const idx = lines[i].indexOf('screeding-before');
    const chunk = lines[i].substring(idx, idx + 80000);
    // Replace escaped newlines with actual newlines for readability
    const cleaned = chunk.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    fs.writeFileSync('_quality_data_raw.txt', cleaned, 'utf8');
    console.log('Written to _quality_data_raw.txt, length:', cleaned.length);
    break;
  }
}
