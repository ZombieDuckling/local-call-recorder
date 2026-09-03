# Local Call Recorder

Local Call Recorder is a local-only desktop recorder for non-technical users on macOS and Windows. It records calls/screen activity to local video files and keeps all data on the device.

The Chrome extension remains in the repo as an optional browser-tab/caption fallback, but the main user path is the desktop app.

## Download installers

Current pilot release:

https://github.com/ZombieDuckling/local-call-recorder/releases/tag/v0.2.0

Assets:

- macOS: `Local-Call-Recorder-macOS-arm64.dmg`
- Windows: `Local-Call-Recorder-Windows-x64-Setup.exe`

The installers are unsigned pilot builds. macOS Gatekeeper and Windows SmartScreen warnings are expected until production signing is added.

## Install from the website

Non-technical users do not need GitHub, Git, or Terminal. Send them to:

https://zombieduckling.github.io/local-call-recorder/

The page has large Mac and Windows download buttons and explains that recordings stay local.

## Desktop recorder

User flow:

1. Download the Mac DMG or Windows setup wizard.
2. Open **Local Call Recorder**.
3. Click **Start recording**.
4. Grant Screen Recording / Microphone permission if the OS asks.
5. Click **Stop + Save**.
6. Find the MP4 locally:
   - macOS: `Movies/Local Call Recorder`
   - Windows: `Videos/Local Call Recorder`

The desktop app has no cloud backend, no analytics, no telemetry, and no upload path.

> Recording calls can create legal and privacy obligations. You must have a lawful basis, notify participants where required, and handle exported files according to POPIA and any other applicable law or workplace policy.

## Platform notes

macOS:

- Uses Apple's local screen-recording permission path.
- The pilot DMG is built locally on Apple Silicon.
- Screen Recording and Microphone permissions must be granted by the user.
- System/call audio capture may require an audio routing device depending on macOS privacy/audio configuration.

Windows:

- The setup wizard is built in GitHub Actions on Windows.
- The pilot build records the desktop locally with packaged recorder tooling.
- System/call audio support depends on available Windows capture devices and needs real-device testing.

## Build desktop installers

macOS local build:

```bash
./scripts/build-macos-desktop.sh
```

Windows CI build:

```bash
gh workflow run build-desktop-windows.yml --ref main
```

## Optional Chrome extension fallback

The extension in `extension/` captures the active Meet or Teams browser tab after the user presses **Start local recording**. It can capture visible live captions from the meeting page and export them as Markdown.

Manual developer install:

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.

This is not the main user install path.

## Local-only assurance

The static policy test fails the build if extension source contains obvious network or tracking primitives, and also scans the desktop Python entrypoints for obvious network/upload/telemetry imports or literals:

- `fetch(`
- `XMLHttpRequest`
- `WebSocket`
- `sendBeacon`
- common analytics SDK names
- `http://` or `https://` endpoint literals outside allowlisted Meet/Teams host permissions in `manifest.json`

Run checks:

```bash
npm test
python3 -m py_compile desktop_launcher.py desktop_recorder/*.py
```

CI also syntax-checks the desktop Python recorder with `py_compile` so privacy-policy checks do not pass while the main local app is broken.

No file leaves the device unless the user manually shares an exported recording or transcript.

## Documentation

- Desktop recorder: `docs/DESKTOP-RECORDER.md`
- Installers: `docs/INSTALLERS.md`
- Architecture: `docs/ARCHITECTURE.md`
- POPIA data handling: `docs/POPIA-DATA-HANDLING.md`
