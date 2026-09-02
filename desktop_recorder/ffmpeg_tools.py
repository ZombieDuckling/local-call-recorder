from __future__ import annotations

import os
import platform
import re
import signal
import subprocess
from pathlib import Path

import imageio_ffmpeg


def ffmpeg_path() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def recordings_dir() -> Path:
    base = Path.home() / "Movies" if platform.system() == "Darwin" else Path.home() / "Videos"
    path = base / "Local Call Recorder"
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_macos_avfoundation_devices() -> str:
    if platform.system() != "Darwin":
        return "Device listing is only available on macOS in this helper."
    proc = subprocess.run(
        [ffmpeg_path(), "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=12,
    )
    return proc.stdout


def parse_macos_devices(output: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    video, audio = [], []
    section = None
    for line in output.splitlines():
        if "AVFoundation video devices" in line:
            section = "video"
            continue
        if "AVFoundation audio devices" in line:
            section = "audio"
            continue
        m = re.search(r"\[(\d+)\]\s+(.+)$", line)
        if m and section == "video":
            video.append((m.group(1), m.group(2).strip()))
        elif m and section == "audio":
            audio.append((m.group(1), m.group(2).strip()))
    return video, audio


def build_ffmpeg_command(output: Path, fps: int = 30, include_mic: bool = True, mac_video_index: str = "0", mac_audio_index: str = "0") -> list[str]:
    system = platform.system()
    ff = ffmpeg_path()
    if system == "Darwin":
        av_input = f"{mac_video_index}:{mac_audio_index if include_mic else 'none'}"
        cmd = [
            ff, "-y", "-hide_banner",
            "-f", "avfoundation", "-framerate", str(fps), "-i", av_input,
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        ]
        if include_mic:
            cmd += ["-c:a", "aac", "-b:a", "160k"]
        else:
            cmd += ["-an"]
        cmd += ["-movflags", "+faststart", str(output)]
        return cmd
    if system == "Windows":
        return [
            ff, "-y", "-hide_banner",
            "-f", "gdigrab", "-framerate", str(fps), "-i", "desktop",
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(output)
        ]
    raise RuntimeError(f"Unsupported OS: {system}")


def build_native_macos_command(output_mov: Path, include_mic: bool = True) -> list[str]:
    cmd = ["/usr/sbin/screencapture", "-v", "-x"]
    if include_mic:
        cmd.append("-g")
    cmd.append(str(output_mov))
    return cmd


def popen_record(output: Path, **kwargs) -> subprocess.Popen:
    system = platform.system()
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if system == "Windows" else 0
    if system == "Darwin":
        # Prefer Apple's native ScreenCaptureKit-backed CLI. It triggers the
        # normal macOS Screen Recording/Microphone permission prompts for the
        # installed app and avoids brittle AVFoundation screen device indices.
        mov_output = output.with_suffix(".mov")
        cmd = build_native_macos_command(mov_output, include_mic=kwargs.get("include_mic", True))
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        proc.local_call_recorder_mov_output = mov_output  # type: ignore[attr-defined]
        proc.local_call_recorder_mp4_output = output      # type: ignore[attr-defined]
        proc.local_call_recorder_native_macos = True      # type: ignore[attr-defined]
        return proc
    cmd = build_ffmpeg_command(output, **kwargs)
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, creationflags=creationflags)


def stop_recording(proc: subprocess.Popen, timeout: int = 12) -> None:
    if proc.poll() is not None:
        finalize_recording(proc)
        return
    try:
        if getattr(proc, "local_call_recorder_native_macos", False):
            proc.send_signal(signal.SIGINT)
        elif proc.stdin:
            proc.stdin.write("q\n")
            proc.stdin.flush()
        proc.wait(timeout=timeout)
    except Exception:
        proc.terminate()
        try:
            proc.wait(timeout=4)
        except Exception:
            proc.kill()
    finalize_recording(proc)


def finalize_recording(proc: subprocess.Popen) -> None:
    if not getattr(proc, "local_call_recorder_native_macos", False):
        return
    mov = getattr(proc, "local_call_recorder_mov_output", None)
    mp4 = getattr(proc, "local_call_recorder_mp4_output", None)
    if not mov or not mp4:
        return
    mov = Path(mov)
    mp4 = Path(mp4)
    if not mov.exists() or mov.stat().st_size == 0:
        return
    subprocess.run([
        ffmpeg_path(), "-y", "-hide_banner", "-i", str(mov),
        "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac",
        "-movflags", "+faststart", str(mp4)
    ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=120)
