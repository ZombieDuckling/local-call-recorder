const els = {
  consent: document.getElementById('consent'),
  notice: document.getElementById('notice'),
  popia: document.getElementById('popia'),
  mic: document.getElementById('mic'),
  note: document.getElementById('note'),
  start: document.getElementById('start'),
  stop: document.getElementById('stop'),
  transcript: document.getElementById('transcript'),
  status: document.getElementById('status')
};

refresh();
setInterval(refresh, 1500);

els.start.addEventListener('click', async () => {
  if (!els.consent.checked || !els.notice.checked || !els.popia.checked) {
    setStatus('Record blocked: complete the consent and POPIA checklist first.');
    return;
  }
  const response = await chrome.runtime.sendMessage({
    type: 'START_RECORDING',
    options: {
      consentConfirmed: true,
      includeMicrophone: els.mic.checked,
      consentNote: els.note.value.trim()
    }
  });
  setStatus(response.ok ? 'Recording started locally.' : `Start failed: ${response.error}`);
  refresh();
});

els.stop.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  setStatus(response.ok ? 'Stopped. Recording and transcript are downloading locally.' : `Stop failed: ${response.error}`);
  refresh();
});

els.transcript.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'EXPORT_TRANSCRIPT' });
  setStatus(response.ok ? `Transcript exported locally (${response.lines} lines).` : `Export failed: ${response.error}`);
});

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' }).catch(error => ({ error: String(error) }));
  if (status?.error) return setStatus(status.error);
  els.start.disabled = Boolean(status.recording);
  els.stop.disabled = !status.recording;
  els.transcript.disabled = false;
  if (status.recording) {
    setStatus(`Recording: ${status.tabTitle || 'meeting'} · captions: ${status.transcriptLines}`);
  } else {
    setStatus(`Idle · captions in current session: ${status.transcriptLines || 0}`);
  }
}

function setStatus(text) { els.status.textContent = text; }
