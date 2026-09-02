import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/convert-md-to-pdf.mjs <transcript.md>');
  process.exit(2);
}
const source = resolve(input.replace(/^~/, process.env.HOME || ''));
if (!existsSync(source)) {
  console.error(`Input not found: ${source}`);
  process.exit(2);
}
const output = join(dirname(source), `${basename(source, extname(source))}.pdf`);
const result = spawnSync('pandoc', [source, '-o', output], { stdio: 'inherit' });
process.exit(result.status ?? 1);
