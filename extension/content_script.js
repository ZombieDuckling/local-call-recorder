const RECORDER_FLAG_ID = 'local-call-recorder-live-flag';
let recording = false;
let seen = new Set();
let interval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'RECORDER_STATE') {
    recording = Boolean(message.recording);
    renderFlag(recording);
    if (recording) startCaptionLoop();
    else stopCaptionLoop();
    sendResponse({ ok: true });
  }
});

function startCaptionLoop() {
  if (interval) return;
  collectAndSendCaptions();
  interval = setInterval(collectAndSendCaptions, 1500);
}

function stopCaptionLoop() {
  if (interval) clearInterval(interval);
  interval = null;
}

function collectAndSendCaptions() {
  if (!recording) return;
  const lines = detectCaptionLines();
  const fresh = [];
  for (const line of lines) {
    const key = `${line.source}:${line.speaker}:${line.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(line);
  }
  if (fresh.length) chrome.runtime.sendMessage({ type: 'CAPTION_BATCH', lines: fresh }).catch(() => {});
}

function detectCaptionLines() {
  const now = new Date().toISOString();
  const source = location.hostname.includes('teams') ? 'teams' : 'meet';
  const candidates = [];
  const selectors = [
    '[aria-live="polite"]',
    '[aria-live="assertive"]',
    '[data-tid*="caption" i]',
    '[class*="caption" i]',
    '[class*="transcript" i]',
    '[jsname]'
  ];
  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      const text = normalize(el.innerText || el.textContent || '');
      if (isLikelyCaption(text)) candidates.push({ source, text, capturedAt: now });
    }
  }

  const splitLines = [];
  for (const item of candidates) {
    for (const line of item.text.split('\n').map(normalize).filter(Boolean)) {
      if (isLikelyCaption(line)) splitLines.push({ ...item, ...parseSpeaker(line), capturedAt: now });
    }
  }
  return dedupe(splitLines).slice(-20);
}

function parseSpeaker(line) {
  const match = line.match(/^([^:]{1,48}):\s*(.+)$/);
  if (match) return { speaker: match[1].trim(), text: match[2].trim() };
  return { speaker: '', text: line };
}

function normalize(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function isLikelyCaption(text) {
  if (!text || text.length < 3 || text.length > 800) return false;
  const lower = text.toLowerCase();
  const blocked = ['microphone', 'camera', 'present now', 'raise hand', 'leave call', 'meeting details', 'participants', 'chat'];
  if (blocked.some(token => lower === token || lower.includes(` ${token} `))) return false;
  return /[a-zA-Z]{2,}/.test(text);
}

function dedupe(lines) {
  const out = [];
  const local = new Set();
  for (const line of lines) {
    const key = `${line.speaker}:${line.text}`;
    if (local.has(key)) continue;
    local.add(key);
    out.push(line);
  }
  return out;
}

function renderFlag(show) {
  let flag = document.getElementById(RECORDER_FLAG_ID);
  if (!show) {
    flag?.remove();
    return;
  }
  if (flag) return;
  flag = document.createElement('div');
  flag.id = RECORDER_FLAG_ID;
  flag.textContent = 'LOCAL RECORDING ACTIVE';
  document.documentElement.appendChild(flag);
}
