const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');
const lines = d.split('\n');
// Find ALL lines containing quality checklist item ids
const sections = ['screeding', 'framework', 'partitions', 'door-frames', 'gyp-ceiling-framework',
  'gyp-ceiling-fixing', 'grid-ceiling', 'glazing', 'wall-cladding', 'lamination', 'painting',
  'carpets', 'ws-loose'];

let allItems = {};
for (let i = 0; i < lines.length; i++) {
  for (const section of sections) {
    if (lines[i].includes(section + '-before-') || lines[i].includes(section + '-during-') || lines[i].includes(section + '-post-')) {
      // Extract all labels from this line
      const regex = new RegExp("id:\\s*['\"](" + section + "-[^'\"]+)['\"][^}]*?label:\\s*['\"]([^'\"]+)['\"]", 'g');
      let m;
      while ((m = regex.exec(lines[i])) !== null) {
        allItems[m[1]] = m[2];
      }
      // Also try escaped quotes
      const regex2 = new RegExp("id:\\s*['\"](" + section + "-[^'\"]+)['\"][^}]*?label:\\s*\\\\['\"]([^\\\\]+)\\\\['\"]", 'g');
      while ((m = regex2.exec(lines[i])) !== null) {
        allItems[m[1]] = m[2];
      }
    }
  }
}
// Sort and print
const sorted = Object.entries(allItems).sort((a,b) => a[0].localeCompare(b[0]));
let curSection = '';
for (const [id, label] of sorted) {
  const parts = id.match(/^(.+?)-(before|during|post)/);
  if (parts && parts[1] !== curSection) {
    curSection = parts[1];
    console.log('\n=== ' + curSection.toUpperCase() + ' ===');
  }
  console.log(id + ': ' + label);
}
console.log('\nTotal items:', sorted.length);
