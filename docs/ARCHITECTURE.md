# Architecture

Local Call Recorder is a Chrome Manifest V3 extension. It records only after the
user starts capture from the extension popup.

## Components

The extension contains these components:

- `manifest.json`: declares the minimum permissions and Meet/Teams host access.
- `popup.html`, `popup.js`, and `popup.css`: provide the recording controls and
  compliance checklist.
- `service_worker.js`: coordinates tab capture, transcript state, and downloads.
- `offscreen.html` and `offscreen.js`: run `MediaRecorder` outside the popup so
  recording continues after the popup closes.
- `content_script.js`: reads visible live captions from Meet and Teams pages.
- `content_overlay.css`: shows a visible recording banner in the call tab.

## Recording path

The recording path is local:

1. The popup sends `START_RECORDING` to the service worker.
2. The service worker checks the active tab URL.
3. The service worker asks Chrome for a tab media stream ID.
4. The offscreen document opens that stream with `getUserMedia`.
5. Optional: the offscreen document opens a microphone stream after browser
   permission.
6. The offscreen document records with `MediaRecorder`.
7. The service worker writes the result through `chrome.downloads`.

## Transcript path

The transcript path is local:

1. The service worker enables the content script recording state.
2. The content script scans visible caption containers.
3. Caption batches are sent to the service worker through extension messaging.
4. The service worker deduplicates lines.
5. The service worker writes a Markdown transcript through `chrome.downloads`.

## Why there is no backend

The extension does not need a backend. Browser APIs provide tab capture,
recording, and downloads. Keeping the design backend-free removes an entire
class of privacy, breach, and cross-border transfer risk.
