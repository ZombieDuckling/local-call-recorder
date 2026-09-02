const status = document.getElementById('status');
const setStatus = text => { status.textContent = text; };

document.getElementById('openChrome').addEventListener('click', async () => {
  const result = await window.setupApi.openChromeExtensions();
  setStatus(result.ok ? 'Chrome extension setup page opened.' : 'Chrome was not found. Opening Chrome download page.');
});

document.getElementById('showFolder').addEventListener('click', async () => {
  const result = await window.setupApi.showExtensionFolder();
  setStatus(result.ok ? 'Extension folder opened. In Chrome, select the highlighted extension folder.' : result.error);
});

document.getElementById('saveZip').addEventListener('click', async () => {
  const result = await window.setupApi.saveExtensionZip();
  if (result.cancelled) return setStatus('Save cancelled.');
  setStatus(result.ok ? `Saved extension zip to ${result.target}` : result.error);
});

document.getElementById('convert').addEventListener('click', async () => {
  setStatus('Converting locally. Keep this window open.');
  const result = await window.setupApi.convertWebm();
  if (result.cancelled) return setStatus('Conversion cancelled.');
  setStatus(result.ok ? `MP4 saved: ${result.output}` : `Conversion failed: ${result.error}`);
});

window.setupApi.getPaths().then(info => {
  const found = info.chromeFound.length ? `Chrome found: ${info.chromeFound[0]}` : 'Chrome not found yet.';
  setStatus(`${found} Extension path: ${info.extensionDir}`);
});
