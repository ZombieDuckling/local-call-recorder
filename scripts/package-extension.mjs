import { rmSync, mkdirSync, readdirSync, statSync, createWriteStream } from 'node:fs';
import { join, relative } from 'node:path';
import yazl from 'yazl';

const outDir = 'dist';
const outFile = join(outDir, 'local-call-recorder-extension.zip');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const zip = new yazl.ZipFile();
for (const file of walk('extension')) {
  zip.addFile(file, relative('extension', file).replaceAll('\\', '/'));
}

await new Promise((resolve, reject) => {
  zip.outputStream.pipe(createWriteStream(outFile)).on('close', resolve).on('error', reject);
  zip.end();
});
console.log(`Wrote ${outFile}`);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
