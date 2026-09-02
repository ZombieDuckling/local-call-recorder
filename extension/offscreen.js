let recorder = null;
let chunks = [];
let mixedStream = null;
let tabStream = null;
let micStream = null;
let activeMetadata = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'OFFSCREEN_START') {
      await start(message);
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'OFFSCREEN_STOP') {
      await stop();
      sendResponse({ ok: true });
      return;
    }
  })().catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});

async function start(message) {
  if (recorder?.state === 'recording') throw new Error('Recorder already running.');
  activeMetadata = message.metadata || {};
  chunks = [];

  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } },
    video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } }
  });

  mixedStream = tabStream;
  if (message.includeMicrophone) {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    mixedStream = mixTabAndMicrophone(tabStream, micStream);
  }

  recorder = new MediaRecorder(mixedStream, { mimeType: preferredMimeType() });
  recorder.ondataavailable = event => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = exportBlob;
  recorder.start(1000);
}

async function stop() {
  if (!recorder || recorder.state !== 'recording') return;
  recorder.stop();
}

function mixTabAndMicrophone(tab, mic) {
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const tabAudio = audioContext.createMediaStreamSource(new MediaStream(tab.getAudioTracks()));
  const micAudio = audioContext.createMediaStreamSource(new MediaStream(mic.getAudioTracks()));
  tabAudio.connect(destination);
  micAudio.connect(destination);
  const output = new MediaStream();
  for (const track of tab.getVideoTracks()) output.addTrack(track);
  for (const track of destination.stream.getAudioTracks()) output.addTrack(track);
  return output;
}

async function exportBlob() {
  const blob = new Blob(chunks, { type: 'video/webm' });
  stopTracks(tabStream);
  stopTracks(micStream);
  stopTracks(mixedStream);
  const dataUrl = await blobToDataUrl(blob);
  await chrome.runtime.sendMessage({
    type: 'RECORDING_COMPLETE',
    dataUrl,
    extension: 'webm',
    mimeType: blob.type,
    bytes: blob.size,
    metadata: activeMetadata
  });
  recorder = null;
  chunks = [];
}

function stopTracks(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function preferredMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
}
