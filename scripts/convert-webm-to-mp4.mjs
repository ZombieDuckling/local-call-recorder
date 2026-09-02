import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/convert-webm-to-mp4.mjs <recording.webm>');
  process.exit(2);
}
const source = resolve(input.replace(/^~/, process.env.HOME || ''));
if (!existsSync(source)) {
  console.error(`Input not found: ${source}`);
  process.exit(2);
}
const output = join(dirname(source), `${basename(source, extname(source))}.mp4`);
const result = spawnSync('ffmpeg', ['-y', '-i', source, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', output], { stdio: 'inherit' });
process.exit(result.status ?? 1);
