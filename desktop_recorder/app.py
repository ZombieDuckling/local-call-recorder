from __future__ import annotations

import platform
import queue
import threading
import time
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import messagebox, ttk

from .ffmpeg_tools import (
    list_macos_avfoundation_devices,
    parse_macos_devices,
    popen_record,
    recordings_dir,
    stop_recording,
)


class RecorderApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Local Call Recorder")
        self.geometry("860x620")
        self.minsize(780, 560)
        self.configure(bg="#f8f0df")
        self.proc = None
        self.output_path: Path | None = None
        self.started_at = None
        self.log_queue: queue.Queue[str] = queue.Queue()
        self.video_devices = []
        self.audio_devices = []
        self._build_ui()
        self._load_devices()
        self.after(250, self._poll_log)
        self.after(500, self._tick_timer)

    def _build_ui(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#f8f0df")
        style.configure("Card.TFrame", background="#fffaf0", relief="flat")
        style.configure("TLabel", background="#f8f0df", foreground="#17130d", font=("Helvetica", 13))
        style.configure("Title.TLabel", font=("Helvetica", 38, "bold"), background="#17130d", foreground="#fff8ec")
        style.configure("Hero.TLabel", font=("Helvetica", 15), background="#17130d", foreground="#eadfcc")
        style.configure("Status.TLabel", font=("Helvetica", 16, "bold"), background="#102818", foreground="#d7ffe6")
        style.configure("TButton", font=("Helvetica", 17, "bold"), padding=14)
        style.configure("Danger.TButton", font=("Helvetica", 17, "bold"), padding=14)

        hero = tk.Frame(self, bg="#17130d", padx=28, pady=24)
        hero.pack(fill="x", padx=24, pady=(24, 14))
        ttk.Label(hero, text="Local-only desktop recorder", style="Title.TLabel").pack(anchor="w")
        ttk.Label(hero, text="Big buttons. No Terminal. No cloud. No uploads.", style="Hero.TLabel").pack(anchor="w", pady=(8, 0))

        controls = tk.Frame(self, bg="#f8f0df")
        controls.pack(fill="x", padx=24)

        self.start_btn = tk.Button(controls, text="● START RECORDING", command=self.start_recording, bg="#ff6500", fg="#17130d", activebackground="#ff8a2a", font=("Helvetica", 24, "bold"), height=2)
        self.start_btn.pack(side="left", expand=True, fill="x", padx=(0, 8))
        self.stop_btn = tk.Button(controls, text="■ STOP + SAVE", command=self.stop_recording, bg="#f7d6b4", fg="#17130d", font=("Helvetica", 24, "bold"), height=2, state="disabled")
        self.stop_btn.pack(side="left", expand=True, fill="x", padx=(8, 0))

        status_frame = tk.Frame(self, bg="#102818", padx=18, pady=14)
        status_frame.pack(fill="x", padx=24, pady=14)
        self.status = tk.Label(status_frame, text="Ready. Click START RECORDING.", bg="#102818", fg="#d7ffe6", font=("Menlo", 16, "bold"), anchor="w")
        self.status.pack(fill="x")

        options = tk.LabelFrame(self, text="Simple options", bg="#fffaf0", fg="#17130d", padx=16, pady=12, font=("Helvetica", 15, "bold"))
        options.pack(fill="x", padx=24, pady=(0, 14))
        self.include_mic = tk.BooleanVar(value=True)
        tk.Checkbutton(options, text="Include microphone audio", variable=self.include_mic, bg="#fffaf0", font=("Helvetica", 14)).grid(row=0, column=0, sticky="w", padx=(0, 20))
        tk.Label(options, text="Screen source", bg="#fffaf0", font=("Helvetica", 13, "bold")).grid(row=1, column=0, sticky="w", pady=(12, 0))
        self.screen_choice = ttk.Combobox(options, state="readonly", width=42)
        self.screen_choice.grid(row=2, column=0, sticky="we", padx=(0, 20))
        tk.Label(options, text="Microphone", bg="#fffaf0", font=("Helvetica", 13, "bold")).grid(row=1, column=1, sticky="w", pady=(12, 0))
        self.mic_choice = ttk.Combobox(options, state="readonly", width=42)
        self.mic_choice.grid(row=2, column=1, sticky="we")
        options.grid_columnconfigure(0, weight=1)
        options.grid_columnconfigure(1, weight=1)

        privacy = tk.LabelFrame(self, text="Privacy", bg="#fffaf0", fg="#17130d", padx=16, pady=12, font=("Helvetica", 15, "bold"))
        privacy.pack(fill="x", padx=24, pady=(0, 14))
        tk.Label(privacy, text="Everything is saved locally to your computer. You decide if an MP4 leaves the device.", bg="#fffaf0", fg="#4d463c", font=("Helvetica", 14), anchor="w").pack(fill="x")
        tk.Label(privacy, text="POPIA: only record when you have a lawful basis/consent and participants are notified where required.", bg="#fffaf0", fg="#4d463c", font=("Helvetica", 14), anchor="w").pack(fill="x", pady=(4, 0))

        self.log = tk.Text(self, height=8, bg="#17130d", fg="#eadfcc", insertbackground="#eadfcc", font=("Menlo", 11), relief="flat")
        self.log.pack(fill="both", expand=True, padx=24, pady=(0, 24))
        self.log.insert("end", "Recorder log will appear here.\n")
        self.log.configure(state="disabled")

    def _load_devices(self):
        if platform.system() == "Darwin":
            try:
                output = list_macos_avfoundation_devices()
                self.video_devices, self.audio_devices = parse_macos_devices(output)
                if not self.video_devices:
                    self.video_devices = [("1", "Capture screen 0")]
                if not self.audio_devices:
                    self.audio_devices = [("0", "Default microphone")]
            except Exception as exc:
                self.video_devices = [("1", "Capture screen 0")]
                self.audio_devices = [("0", "Default microphone")]
                self._append_log(f"Device detection fallback: {exc}")
        elif platform.system() == "Windows":
            self.video_devices = [("desktop", "Entire desktop")]
            self.audio_devices = [("none", "Screen-only in this pilot build")]
            self.include_mic.set(False)
        else:
            self.video_devices = []
            self.audio_devices = []

        self.screen_choice["values"] = [f"{idx}: {name}" for idx, name in self.video_devices]
        self.mic_choice["values"] = [f"{idx}: {name}" for idx, name in self.audio_devices]
        if self.video_devices:
            self.screen_choice.current(0)
        if self.audio_devices:
            self.mic_choice.current(0)

    def start_recording(self):
        if self.proc:
            return
        if not messagebox.askyesno("Confirm recording", "Only record if everyone who needs to know has been told. Start recording now?"):
            return
        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self.output_path = recordings_dir() / f"Local-Call-Recording-{ts}.mp4"
        video_idx = self.video_devices[self.screen_choice.current()][0] if self.video_devices else "1"
        audio_idx = self.audio_devices[self.mic_choice.current()][0] if self.audio_devices else "0"
        try:
            self.proc = popen_record(self.output_path, include_mic=self.include_mic.get(), mac_video_index=video_idx, mac_audio_index=audio_idx)
        except Exception as exc:
            messagebox.showerror("Could not start recording", str(exc))
            self.proc = None
            return
        self.started_at = time.time()
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.status.configure(text=f"Recording locally → {self.output_path.name}")
        self._append_log(f"Started recording: {self.output_path}")
        threading.Thread(target=self._read_proc_output, daemon=True).start()

    def stop_recording(self):
        if not self.proc:
            return
        self.status.configure(text="Saving MP4 locally...")
        stop_recording(self.proc)
        code = self.proc.poll()
        self._append_log(f"Recorder stopped with code {code}")
        if self.output_path and self.output_path.exists() and self.output_path.stat().st_size > 0:
            self.status.configure(text=f"Saved: {self.output_path}")
            messagebox.showinfo("Recording saved", f"Saved MP4 locally:\n{self.output_path}")
        else:
            self.status.configure(text="Recording stopped, but no MP4 was created. Check permissions and source selection.")
            messagebox.showwarning("No file created", "No MP4 was created. On macOS, grant Screen Recording and Microphone permissions, then try again.")
        self.proc = None
        self.started_at = None
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")

    def _read_proc_output(self):
        if not self.proc or not self.proc.stdout:
            return
        for line in self.proc.stdout:
            self.log_queue.put(line.rstrip())

    def _poll_log(self):
        while not self.log_queue.empty():
            self._append_log(self.log_queue.get())
        self.after(250, self._poll_log)

    def _tick_timer(self):
        if self.proc and self.started_at:
            elapsed = int(time.time() - self.started_at)
            self.status.configure(text=f"Recording locally · {elapsed//60:02d}:{elapsed%60:02d} · {self.output_path.name if self.output_path else ''}")
        self.after(500, self._tick_timer)

    def _append_log(self, text: str):
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")


def main():
    app = RecorderApp()
    app.mainloop()
