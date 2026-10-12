// Prettier over every tracked file Prettier supports. Fails if it matched nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as prettier from 'prettier';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const bad = [];
let checked = 0;
for (const file of tracked) {
  const info = await prettier.getFileInfo(file, {
    ignorePath: '.prettierignore',
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) continue;
  const options = (await prettier.resolveConfig(file)) ?? {};
  const ok = await prettier.check(readFileSync(file, 'utf8'), { ...options, filepath: file });
  checked += 1;
  if (!ok) bad.push(file);
}

if (checked === 0) {
  console.error('format: Prettier matched no files; refusing to pass');
  process.exit(1);
}
for (const f of bad) console.error(`[warn] ${f}`);
console.log(`format: ${checked} files checked, ${bad.length} need formatting`);
if (bad.length > 0) process.exit(1);
