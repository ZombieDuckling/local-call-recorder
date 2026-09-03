import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionRoot = join(root, 'extension');
const desktopRoots = [join(root, 'desktop_recorder')];
const desktopEntrypoints = [join(root, 'desktop_launcher.py')];
const files = walk(extensionRoot).filter(file => /\.(js|json|html|css)$/.test(file));
const desktopFiles = [
  ...desktopRoots.flatMap(dir => walk(dir)),
  ...desktopEntrypoints
].filter(file => /\.py$/.test(file));

const forbidden = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /google-analytics/i,
  /gtag\s*\(/,
  /mixpanel/i,
  /segment\.com/i,
  /posthog/i,
  /sentry\.io/i,
  /https?:\/\//i
];

const desktopForbidden = [
  /\brequests\b/,
  /\burllib\b/,
  /\bhttp\.client\b/,
  /\bsocket\b/,
  /\bsmtplib\b/,
  /\bftplib\b/,
  /\bwebbrowser\b/,
  /\bfetch\b/,
  /\b[a-z]+:\/\//i,
  /\b(upload|webhook|telemetry|analytics|tracking[_-]?id)\b/i
];

const allowlistedUrlFiles = new Set(['manifest.json']);
const failures = [];
for (const file of files) {
  const rel = relative(extensionRoot, file);
  const text = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.source.includes('https?') && allowlistedUrlFiles.has(rel)) continue;
    if (pattern.test(text)) failures.push(`${rel} matched forbidden pattern ${pattern}`);
  }
}

const manifest = JSON.parse(readFileSync(join(extensionRoot, 'manifest.json'), 'utf8'));
const allowedHosts = ['https://meet.google.com/*', 'https://teams.microsoft.com/*'];
for (const host of manifest.host_permissions || []) {
  if (!allowedHosts.includes(host)) failures.push(`Unexpected host permission: ${host}`);
}
const allowedPermissions = new Set(['activeTab', 'tabCapture', 'downloads', 'storage', 'offscreen', 'scripting']);
for (const permission of manifest.permissions || []) {
  if (!allowedPermissions.has(permission)) failures.push(`Unexpected permission: ${permission}`);
}

for (const file of desktopFiles) {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  for (const pattern of desktopForbidden) {
    if (pattern.test(text)) failures.push(`${rel} matched forbidden desktop pattern ${pattern}`);
  }
}

if (failures.length) {
  console.error('Static local-only policy failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Static local-only policy passed for ${files.length} extension files and ${desktopFiles.length} desktop Python files.`);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
