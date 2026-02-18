const fs = require('fs');
const d = fs.readFileSync('C:/Users/user/.claude/projects/E--/a04ab78e-762f-46fb-8865-246aec3697aa.jsonl', 'utf8');
const lines = d.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('screeding-before-start-of-work')) {
    const idx = lines[i].indexOf('screeding-before');
    const chunk = lines[i].substring(idx, idx + 80000);
    // Extract all id+label pairs
    const regex = /id:\s*'([^']+)'[^}]*?label:\s*(?:"([^"]+)"|\\?"([^\\]+?)\\?")/g;
    let m;
    let currentSection = '';
    while ((m = regex.exec(chunk)) !== null) {
      const id = m[1];
      const label = m[2] || m[3];
      const sectionParts = id.split('-');
      // Determine section name from id prefix
      const sectionEnd = id.lastIndexOf('-before-') !== -1 ? id.lastIndexOf('-before-') :
                         id.lastIndexOf('-during-') !== -1 ? id.lastIndexOf('-during-') :
                         id.lastIndexOf('-post-') !== -1 ? id.lastIndexOf('-post-') : -1;
      if (sectionEnd === -1) continue;

      const section = id.substring(0, sectionEnd);
      const phase = id.includes('-before-') ? 'Before' : id.includes('-during-') ? 'During' : 'Post';

      if (section !== currentSection) {
        console.log('\n=== ' + section.toUpperCase() + ' ===');
        currentSection = section;
      }
      console.log(`[${phase}] ${id}: ${label}`);
    }
    break;
  }
}
