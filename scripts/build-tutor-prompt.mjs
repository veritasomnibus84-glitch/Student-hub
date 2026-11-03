// Génère js/tutor-prompt.js depuis docs/fds-tutor.md (le prompt système du tuteur). Lance : npm run build:tutor
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../docs/fds-tutor.md', import.meta.url), 'utf8');
writeFileSync(new URL('../js/tutor-prompt.js', import.meta.url),
  `// Fichier généré par scripts/build-tutor-prompt.mjs à partir de docs/fds-tutor.md : ne pas modifier à la main.\nexport default ${JSON.stringify(src)};\n`);
console.log('js/tutor-prompt.js généré');
