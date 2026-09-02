# Installer distribution

Local Call Recorder includes a desktop setup helper for non-technical users. The
helper is packaged as a macOS DMG and a Windows installer. The intended user
path requires no Terminal, no GitHub knowledge, and no command-line tools.

## What the installer can do

The setup app gives users buttons for the full non-terminal path:

1. Open Chrome's extension setup page.
2. Show the prepared extension folder.
3. Save the packaged extension zip for IT handoff.
4. Convert local WebM recordings to MP4 on the device.

## Chrome's required approval step

Chrome does not allow a normal consumer installer to silently add an unpacked
extension. This is a browser security rule. The user must approve extension
loading in Chrome, or an organisation must deploy the extension with Chrome
enterprise policy.

For public one-click distribution, publish the extension through the Chrome Web
Store. For managed company devices, use Chrome enterprise policy deployment.

## User path

A non-technical user follows this path:

1. Download the macOS DMG or Windows installer.
2. Open **Local Call Recorder Setup**.
3. Click **Open Chrome setup**.
4. Click **Show recorder folder**.
5. In Chrome, choose the highlighted `extension` folder.
6. Pin **Local Call Recorder** and start recording meetings.

No terminal is required.

## Production recommendation

Use the helper app for pilots and internal testing. For a consumer-grade release,
ship through the Chrome Web Store so installation becomes a normal browser
install flow.
