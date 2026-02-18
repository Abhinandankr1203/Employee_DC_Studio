const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');

// Extract ALL quality checklist items using a broad regex
const regex = /id:\s*'([a-z][a-z0-9-]+-(?:before-start-of-work|during-execution|post-completion)-\d+)'\s*,\s*\d+→\s*label:\s*\\?"([^"\\]+)\\?"/g;
let m;
const items = {};
while ((m = regex.exec(d)) !== null) {
  items[m[1]] = m[2];
}

// Also try without line numbers
const regex2 = /id:\s*'([a-z][a-z0-9-]+-(?:before-start-of-work|during-execution|post-completion)-\d+)'\s*,[^}]*?label:\s*\\?"([^"\\]+)\\?"/g;
while ((m = regex2.exec(d)) !== null) {
  items[m[1]] = m[2];
}

const sorted = Object.entries(items).sort((a,b) => a[0].localeCompare(b[0]));
let curSection = '';
for (const [id, label] of sorted) {
  const sectionMatch = id.match(/^(.+?)-(before-start|during-exec|post-comp)/);
  if (sectionMatch && sectionMatch[1] !== curSection) {
    curSection = sectionMatch[1];
    console.log('\n=== ' + curSection.toUpperCase() + ' ===');
  }
  console.log(id + ': ' + label);
}
console.log('\nTotal items:', sorted.length);
