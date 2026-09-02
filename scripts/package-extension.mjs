import { rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
const result = spawnSync('zip', ['-r', '../dist/local-call-recorder-extension.zip', '.'], { cwd: 'extension', stdio: 'inherit' });
process.exit(result.status ?? 1);
