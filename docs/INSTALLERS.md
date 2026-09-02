# Installers

Local Call Recorder's main user path is a non-Electron desktop recorder app.
Users do not need Git, GitHub, Terminal, Node.js, Python, or FFmpeg.

## Current release

Download pilot installers from:

https://github.com/ZombieDuckling/local-call-recorder/releases/tag/v0.2.0

Assets:

- `Local-Call-Recorder-macOS-arm64.dmg` — macOS Apple Silicon DMG.
- `Local-Call-Recorder-Windows-x64-Setup.exe` — Windows x64 setup wizard.

These builds are currently unsigned, so macOS Gatekeeper and Windows SmartScreen warnings are expected until production signing is added.

## User flow

1. Open the Mac DMG or Windows setup wizard.
2. Launch **Local Call Recorder**.
3. Click **Start recording**.
4. Grant Screen Recording / Microphone permission if the OS asks.
5. Click **Stop + Save**.
6. Find the MP4 locally:
   - macOS: `Movies/Local Call Recorder`
   - Windows: `Videos/Local Call Recorder`

## Build macOS locally

```bash
./scripts/build-macos-desktop.sh
```

Output:

- `release-desktop/Local-Call-Recorder-macOS-arm64.dmg`

## Build Windows in GitHub Actions

Workflow:

- `.github/workflows/build-desktop-windows.yml`

The workflow creates the Windows setup EXE as an artifact. The published v0.2.0 release was created from that artifact.

## Optional Chrome extension fallback

The Chrome extension remains in `extension/` for browser-tab audio and visible-caption capture. It is not the main install path anymore.
