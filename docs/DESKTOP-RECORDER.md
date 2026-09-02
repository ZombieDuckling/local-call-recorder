# Desktop recorder

Local Call Recorder now includes a non-Electron desktop app for non-technical
users. The app records locally and saves MP4 files to the user's computer.

## User experience

The desktop app has two primary buttons:

1. **Start recording** starts local capture.
2. **Stop + save** writes an MP4 to the local `Movies` or `Videos` folder.

The user does not need Git, GitHub, Terminal, Node.js, Python, or FFmpeg.

## macOS behavior

The macOS build records screen video and microphone audio through FFmpeg's
AVFoundation input. macOS asks for Screen Recording and Microphone permissions.

macOS system audio from other apps is not captured by this implementation unless
the user routes audio through a virtual audio device. For browser-tab audio and
captions, use the Chrome extension path.

## Windows behavior

The Windows build records the desktop through FFmpeg's `gdigrab` input. The pilot
build defaults to screen capture. Call/system audio support depends on available
Windows audio capture devices and will be extended after testing on a Windows
machine.

## Local-only boundary

The desktop app has no cloud backend, no telemetry, no analytics, and no upload
path. The recording output is a local MP4 file. Once the user shares that file,
it leaves the app's control.
