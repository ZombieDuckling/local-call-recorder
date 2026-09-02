import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = app.isPackaged ? process.resourcesPath : dirname(__dirname);
const extensionDir = join(projectRoot, 'extension');
const extensionZip = join(projectRoot, 'dist', 'local-call-recorder-extension.zip');

let win;

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

function createWindow() {
  win = new BrowserWindow({
    width: 940,
    height: 720,
    minWidth: 820,
    minHeight: 620,
    title: 'Local Call Recorder Setup',
    backgroundColor: '#090909',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(join(__dirname, 'index.html'));
}

ipcMain.handle('paths:get', () => ({
  extensionDir,
  extensionZip,
  platform: process.platform,
  chromeFound: findChromeCandidates().filter(existsSync)
}));

ipcMain.handle('chrome:openExtensions', async () => {
  const opened = await openChromeExtensionsPage();
  return { ok: opened };
});

ipcMain.handle('folder:showExtension', async () => {
  if (existsSync(extensionDir)) {
    shell.showItemInFolder(join(extensionDir, 'manifest.json'));
    return { ok: true };
  }
  return { ok: false, error: 'Extension folder not found.' };
});

ipcMain.handle('zip:saveExtension', async () => {
  const target = dialog.showSaveDialogSync(win, {
    title: 'Save extension zip',
    defaultPath: 'local-call-recorder-extension.zip',
    filters: [{ name: 'Zip archive', extensions: ['zip'] }]
  });
  if (!target) return { ok: false, cancelled: true };
  copyFileSync(extensionZip, target);
  return { ok: true, target };
});

ipcMain.handle('converter:pickWebm', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose WebM recording to convert',
    properties: ['openFile'],
    filters: [{ name: 'WebM recordings', extensions: ['webm'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  return convertWithFfmpeg(result.filePaths[0]);
});

async function openChromeExtensionsPage() {
  const candidates = findChromeCandidates().filter(existsSync);
  const url = 'chrome://extensions';
  if (!candidates.length) {
    await shell.openExternal('https://www.google.com/chrome/');
    return false;
  }
  const exe = candidates[0];
  const args = process.platform === 'darwin' ? ['--args', url] : [url];
  spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
  return true;
}

function findChromeCandidates() {
  if (process.platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.map(root => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
}

function convertWithFfmpeg(input) {
  return new Promise(resolve => {
    const out = input.replace(/\.webm$/i, '.mp4');
    const ffmpeg = findBundledOrSystemFfmpeg();
    if (!ffmpeg) return resolve({ ok: false, error: 'FFmpeg is not bundled/found yet. Use the WebM file directly or install FFmpeg.' });
    const child = spawn(ffmpeg, ['-y', '-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', out]);
    let err = '';
    child.stderr.on('data', data => { err += data.toString(); });
    child.on('close', code => {
      if (code === 0) resolve({ ok: true, output: out });
      else resolve({ ok: false, error: err.slice(-1200) || `ffmpeg exited ${code}` });
    });
  });
}

function findBundledOrSystemFfmpeg() {
  const candidates = [];
  if (process.platform === 'darwin') candidates.push(join(projectRoot, 'bin', 'mac', 'ffmpeg'));
  if (process.platform === 'win32') candidates.push(join(projectRoot, 'bin', 'win', 'ffmpeg.exe'));
  candidates.push('ffmpeg');
  for (const c of candidates) {
    if (c === 'ffmpeg') return c;
    if (existsSync(c)) return c;
  }
  return null;
}
