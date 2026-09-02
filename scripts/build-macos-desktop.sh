#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv-desktop
source .venv-desktop/bin/activate
python -m pip install --upgrade pip
pip install -r requirements-build.txt
rm -rf build dist-desktop release-desktop
rm -f "Local Call Recorder.spec"
pyinstaller --noconfirm --windowed --name "Local Call Recorder" --collect-all imageio_ffmpeg desktop_launcher.py --distpath dist-desktop --workpath build/pyinstaller
mkdir -p release-desktop/dmg-root
cp -R "dist-desktop/Local Call Recorder.app" "release-desktop/dmg-root/"
ln -s /Applications "release-desktop/dmg-root/Applications"
hdiutil create -volname "Local Call Recorder" -srcfolder "release-desktop/dmg-root" -ov -format UDZO "release-desktop/Local-Call-Recorder-macOS-arm64.dmg"
