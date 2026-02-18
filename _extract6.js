const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');

// Search for any quality checklist IDs we might have missed
const patterns = ['door-frame', 'door_frame', 'doorframe', 'gyp-ceiling-frame', 'wall-cladding', 'wall_cladding',
  'lamination', 'veneering', 'carpet', 'vinyl', 'ws-loose', 'ws_loose', 'loose-furniture',
  'ws-and-loose', 'workstation'];

for (const p of patterns) {
  const idx = d.indexOf(p);
  if (idx !== -1) {
    console.log(`Found "${p}" at index ${idx}`);
    // Show some context
    const start = Math.max(0, idx - 50);
    const ctx = d.substring(start, idx + 200).replace(/\\n/g, ' ');
    console.log('  Context:', ctx.substring(0, 250));
    console.log('');
  } else {
    console.log(`NOT FOUND: "${p}"`);
  }
}
