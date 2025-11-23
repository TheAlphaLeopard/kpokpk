# TTS Virtual Mic — Chrome Extension (Discord Web)

This repository contains a Chrome extension that injects a TTS MediaStream into Discord Web so the web client receives the synthesized audio as the microphone. This works only in the browser (discord.com) and does not affect the Discord desktop app.

Files
- `manifest.json` — extension manifest (MV3)
- `popup.html` / `popup.js` — popup UI to enter text, set TTS, and play
- `content_script.js` — runs on `discord.com`, injects the in-page script and fetches TTS audio
- `inpage.js` — injected into the page context; decodes the audio and overrides `navigator.mediaDevices.getUserMedia` to return a MediaStream sourced from the TTS

How it works
- Click the extension popup and enter text. Click "Use as mic" to fetch TTS audio and load it into the page. Click "Speak now" to play it. The injected script creates an `AudioContext` -> `MediaStreamDestination`, plays the decoded audio into that destination, and returns the destination's stream when `getUserMedia` is called.

Limitations & notes
- Browser-only: This cannot change system-level or desktop Discord microphone devices. Use the Discord web client at `https://discord.com/app`.
- The extension fetches TTS from Google Translate's public endpoint for quick testing. This is not an official API — for heavy or production use use a paid TTS service.
- The extension must run before Discord requests the microphone. Reload the Discord Web page after loading the extension so the content script runs at `document_start`.
- Discord updates could break this approach.

Installation (load unpacked)
1. Open Chrome (or Chromium-based browser) and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this repository folder.
4. Visit `https://discord.com/app` and reload the page.
5. Open the extension popup, enter text, click **Use as mic**, then join a voice channel in Discord Web and click **Speak now**.

Troubleshooting
- If audio doesn't go through:
  - Ensure you loaded the extension and reloaded Discord Web after installing.
  - Ensure the content script is running: open DevTools on Discord Web, check Console for "TTS Virtual Mic" logs.
  - Some browsers block autoplay or audio context until user interaction — ensure you interact with the page (click) before using.

If you want, I can:
- Add language selection and voice-speed options.
- Replace the public Google Translate endpoint with an official TTS provider (requires API key).
- Add a small settings page and persistent storage for last text.
**TTS Virtual Microphone (Electron)**

Overview
- This local Electron app synthesizes text-to-speech and plays it into a virtual microphone device. On Linux it creates a PulseAudio null sink named `TTS_SINK`, whose monitor (`TTS_SINK.monitor`) can be selected as the input device in Discord. This avoids logging in or automating your Discord account.

What this provides
- A small GUI where you type text and press "Speak".
- The spoken audio is routed into a virtual microphone Discord can select.

Requirements (Linux)
- Node.js (18+)
- `npm` or `pnpm`
- `ffmpeg` and/or `ffplay` (for playback and conversion)
- `pulseaudio` (or PipeWire with PulseAudio compatibility)

Windows requirements
- Node.js (18+)
- `npm`
- `ffmpeg` (install a build that includes `ffplay` and put it in your PATH)
- VB-Audio Virtual Cable (VB-Cable) if you want a virtual microphone

Quick setup (Linux)
1. Install system deps (Ubuntu):
```bash
sudo apt update && sudo apt install -y ffmpeg pulseaudio-utils
```
2. Install Node deps and start app:
```bash
cd /path/to/project
npm install
npx electron .
```
3. The app will try to create a PulseAudio null sink named `TTS_SINK`. If it fails, run manually:
```bash
pactl load-module module-null-sink sink_name=TTS_SINK sink_properties=device.description="TTS Microphone"
```
4. In Discord, open Settings → Voice & Video → Input Device and choose the monitor source for the sink. The name will be like `TTS_SINK.monitor` or the device description `TTS Microphone`.

Notes for Windows/macOS
- Windows: use a virtual audio cable product such as VB-Audio Virtual Cable, then in the app set that cable as the default playback device (or modify code to use it). The app currently plays sound locally; routing to a virtual cable requires setting the playback device or system default.
- macOS: use BlackHole or similar to create an aggregate device and route playback into it.

Windows detailed steps
- Install VB-Audio Virtual Cable (VB-Cable): https://vb-audio.com/Cable/
- After installation you will see devices named like "CABLE Input (VB-Audio Virtual Cable)" and "CABLE Output (VB-Audio Virtual Cable)".
- To make Discord receive the TTS audio, you need the app to output its audio into the virtual cable. Two common approaches:
	- Set the virtual cable as your system Default Playback device (so Electron/ffplay output goes into it). Open Windows Sound Settings -> Output -> choose "CABLE Input".
	- Or install `nircmd` (https://www.nirsoft.net/utils/nircmd.html) and place `nircmd.exe` somewhere (e.g. `C:\\tools\\nircmd.exe`). The app can call `nircmd` to set the default playback device automatically before speaking. Example (substitute exact device name):
		```powershell
		nircmd setdefaultsounddevice "CABLE Input (VB-Audio Virtual Cable)"
		```
- In this app: open Settings, enter the exact device name (e.g. `CABLE Input (VB-Audio Virtual Cable)`), supply the path to `nircmd.exe` if you want automatic switching, and enable "Automatically set default playback device before speaking". When enabled, the app will try to call `nircmd` to set the system default playback device to the virtual cable before playing the TTS audio.
- In Discord, go to Settings → Voice & Video and set Input Device to the virtual cable's input (Discord might list the device name slightly differently). If Discord doesn't list the device, try restarting Discord after installing the cable.
- Optional: use an audio routing tool like VoiceMeeter if you need more control over mixing and levels.

Notes about Windows automation
- The app cannot create virtual audio devices for you — install VB-Cable (or similar) first. The automatic switching feature requires `nircmd.exe` and will set the system default playback device. That affects other applications while active. The app does not currently restore the previous default device automatically; if you need restore behaviour I can add it (the app can save the previous default and restore after speaking).

How it works (technical)
- On Linux the app creates a PulseAudio null sink. Playback to that sink appears on its monitor source, which other apps (Discord) can select as microphone input.
- The app uses `google-tts-api` to get a TTS MP3 from Google's translate backend, downloads it, and plays it via `ffplay` or `paplay` redirected to the virtual sink.

Security & Discord policy
- This tool does not automate or log into your Discord account. You will manually select the virtual microphone in the official Discord client.

Next steps / improvements
- Add system tray controls and hotkeys for quick TTS.
- Support per-sentence queueing and adjustable voice/lang.
- Provide a platform-specific guide to automatically route output to virtual devices on Windows/macOS.

If you want, I can:
- Add a toggle to auto-create the PulseAudio sink at startup (already attempted on Linux).
- Extend support for Windows (VB-Cable) with instructions and code to target a chosen device.
# kpokpk
nnnn
