const state = {
  recording: false,
  startedAt: null,
  tabId: null,
  tabTitle: '',
  meetingUrl: '',
  transcript: [],
  consent: null,
  includeMicrophone: false
};

const OFFSCREEN_URL = 'offscreen.html';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'GET_STATUS') {
      sendResponse(snapshot());
      return;
    }

    if (message?.type === 'START_RECORDING') {
      const result = await startRecording(message.options || {});
      sendResponse(result);
      return;
    }

    if (message?.type === 'STOP_RECORDING') {
      const result = await stopRecording();
      sendResponse(result);
      return;
    }

    if (message?.type === 'CAPTION_BATCH') {
      ingestCaptions(message.lines || []);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'OFFSCREEN_READY') {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'RECORDING_COMPLETE') {
      await saveRecording(message);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'EXPORT_TRANSCRIPT') {
      const result = await exportTranscript();
      sendResponse(result);
      return;
    }
  })().catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});

function snapshot() {
  return {
    recording: state.recording,
    startedAt: state.startedAt,
    tabTitle: state.tabTitle,
    meetingUrl: state.meetingUrl,
    transcriptLines: state.transcript.length,
    includeMicrophone: state.includeMicrophone
  };
}

async function startRecording(options) {
  if (state.recording) return { ok: false, error: 'Recording is already running.' };
  if (!options?.consentConfirmed) {
    return { ok: false, error: 'Consent confirmation is required before recording.' };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isSupportedMeetingUrl(tab.url || '')) {
    return { ok: false, error: 'Open a Google Meet or Microsoft Teams call tab first.' };
  }

  await ensureContentScript(tab.id);
  await ensureOffscreenDocument();

  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  const startedAt = new Date().toISOString();
  Object.assign(state, {
    recording: true,
    startedAt,
    tabId: tab.id,
    tabTitle: tab.title || 'meeting',
    meetingUrl: tab.url || '',
    transcript: [],
    consent: {
      confirmed: true,
      consentNote: options.consentNote || '',
      confirmedAt: startedAt
    },
    includeMicrophone: Boolean(options.includeMicrophone)
  });

  await chrome.tabs.sendMessage(tab.id, { type: 'RECORDER_STATE', recording: true }).catch(() => {});
  await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_START',
    streamId,
    includeMicrophone: state.includeMicrophone,
    metadata: meetingMetadata()
  });

  return { ok: true, status: snapshot() };
}

async function stopRecording() {
  if (!state.recording) return { ok: false, error: 'No recording is running.' };
  await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
  if (state.tabId) {
    await chrome.tabs.sendMessage(state.tabId, { type: 'RECORDER_STATE', recording: false }).catch(() => {});
  }
  const transcriptResult = await exportTranscript();
  state.recording = false;
  return { ok: true, transcript: transcriptResult };
}

function ingestCaptions(lines) {
  const seen = new Set(state.transcript.map(line => line.key));
  for (const line of lines) {
    const text = String(line.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const key = `${line.source || 'caption'}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    state.transcript.push({
      key,
      source: line.source || 'caption',
      speaker: line.speaker || '',
      text,
      capturedAt: line.capturedAt || new Date().toISOString(),
      meetingOffsetMs: state.startedAt ? Date.now() - Date.parse(state.startedAt) : 0
    });
  }
}

async function exportTranscript() {
  const metadata = meetingMetadata();
  const safeName = safeFilename(`${metadata.startedAtLocal}-${metadata.title}-transcript.md`);
  const body = buildMarkdownTranscript(metadata);
  const url = `data:text/markdown;charset=utf-8,${encodeURIComponent(body)}`;
  const downloadId = await chrome.downloads.download({ url, filename: `Local Call Recorder/${safeName}`, saveAs: false });
  return { ok: true, downloadId, filename: safeName, lines: state.transcript.length };
}

async function saveRecording(message) {
  const extension = message.extension || 'webm';
  const safeName = safeFilename(`${meetingMetadata().startedAtLocal}-${state.tabTitle || 'meeting'}.${extension}`);
  const downloadId = await chrome.downloads.download({
    url: message.dataUrl,
    filename: `Local Call Recorder/${safeName}`,
    saveAs: false
  });
  return { ok: true, downloadId, filename: safeName };
}

function buildMarkdownTranscript(metadata) {
  const lines = [];
  lines.push(`# Local call transcript`);
  lines.push('');
  lines.push(`- Title: ${metadata.title}`);
  lines.push(`- URL: ${metadata.url}`);
  lines.push(`- Started: ${metadata.startedAt}`);
  lines.push(`- Exported: ${new Date().toISOString()}`);
  lines.push(`- Processing: local-only Chrome extension; no backend; no upload path.`);
  lines.push(`- Consent note: ${state.consent?.consentNote || 'User confirmed recording consent/compliance before start.'}`);
  lines.push('');
  lines.push('> POPIA note: This export is personal information if it identifies a participant. Store, share, and delete it according to your lawful basis, notice, retention, and security obligations.');
  lines.push('');
  lines.push('## Captions captured from the meeting UI');
  lines.push('');
  if (!state.transcript.length) {
    lines.push('_No captions were captured. Turn on live captions in Meet/Teams before or during recording._');
  } else {
    for (const item of state.transcript) {
      const seconds = Math.max(0, Math.round((item.meetingOffsetMs || 0) / 1000));
      const stamp = new Date(seconds * 1000).toISOString().substring(11, 19);
      const speaker = item.speaker ? ` **${item.speaker}:**` : '';
      lines.push(`- ${stamp}${speaker} ${item.text}`);
    }
  }
  lines.push('');
  lines.push('## Local-only assurance');
  lines.push('');
  lines.push('- The extension has no network permissions beyond Meet and Teams page access.');
  lines.push('- The code contains no browser network client APIs, analytics SDKs, telemetry SDKs, or remote transcription endpoints.');
  lines.push('- Recordings and transcript files are written through Chrome Downloads to your device.');
  return lines.join('\n');
}

function meetingMetadata() {
  return {
    title: state.tabTitle || 'meeting',
    url: state.meetingUrl || '',
    startedAt: state.startedAt || new Date().toISOString(),
    startedAtLocal: (state.startedAt || new Date().toISOString()).replace(/[:.]/g, '-')
  };
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content_script.js'] });
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content_overlay.css'] });
  }
}

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)] });
  if (existing.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Record the selected meeting tab locally after the user starts recording.'
  });
}

function isSupportedMeetingUrl(url) {
  return /^https:\/\/meet\.google\.com\//.test(url) || /^https:\/\/teams\.microsoft\.com\//.test(url);
}

function safeFilename(name) {
  return name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 180);
}
