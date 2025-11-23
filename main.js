const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const googleTTS = require('google-tts-api');
const fetch = (...args) => import('node-fetch').then(m=>m.default(...args));

const SINK_NAME = 'TTS_SINK';

const CONFIG_FILE = path.join(app ? app.getPath('userData') : os.tmpdir(), 'tts-config.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 240,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('renderer/index.html');
}

function loadConfig(){
  try{
    if (fs.existsSync(CONFIG_FILE)){
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch(e) { console.warn('Failed to load config', e); }
  return { deviceName: '', nircmdPath: '', autoSet: false };
}

function saveConfig(cfg){
  try{
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch(e){ console.warn('Failed to save config', e); return false; }
}

function execPromise(cmd, opts={}){
  return new Promise((resolve, reject)=>{
    exec(cmd, opts, (err, stdout, stderr)=>{
      if (err) return reject({err, stdout, stderr});
      resolve({stdout, stderr});
    });
  });
}

async function executableExists(name){
  try{
    if (process.platform === 'win32'){
      await execPromise(`where ${name}`);
    } else {
      await execPromise(`which ${name}`);
    }
    return true;
  } catch(e){ return false; }
}

async function speakText(text) {
  if (!text || !text.trim()) return;
  const lang = 'en';
  // get URL from google-tts-api
  const url = googleTTS.getAudioUrl(text, {
    lang,
    slow: false,
    host: 'https://translate.google.com',
  });

  const tmpfile = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
  const res = await fetch(url);
  const dest = fs.createWriteStream(tmpfile);
  await new Promise((resolve, reject)=>{
    res.body.pipe(dest);
    res.body.on('error', reject);
    dest.on('finish', resolve);
  });

  // Play to PulseAudio sink if on Linux
  if (process.platform === 'linux'){
    const env = Object.assign({}, process.env, { PULSE_SINK: SINK_NAME });
    // Try ffplay, then paplay
    try {
      await execPromise(`ffplay -nodisp -autoexit -loglevel quiet "${tmpfile}"`, { env });
    } catch (e) {
      try {
        // paplay may not support mp3 directly; convert via ffmpeg to wav streamed to paplay
        await execPromise(`ffmpeg -loglevel error -i "${tmpfile}" -f wav - | PULSE_SINK=${SINK_NAME} paplay --raw --format=s16le --channels=2 --rate=44100 -`, {});
      } catch (e2) {
        dialog.showErrorBox('Playback failed', 'Install ffmpeg/ffplay or paplay to enable audio playback to the virtual sink.');
      }
    }
  } else {
    // Windows: try to route to a virtual cable by temporarily setting the default playback device using nircmd (if configured)
    if (process.platform === 'win32'){
        const cfg = loadConfig();
        if (cfg && cfg.autoSet && cfg.nircmdPath && cfg.deviceName){
          try{
            // ensure nircmd executable exists
            const exists = fs.existsSync(cfg.nircmdPath);
            if (!exists) throw new Error('nircmd.exe not found at configured path.');
            // set default playback device
            await execPromise(`"${cfg.nircmdPath}" setdefaultsounddevice "${cfg.deviceName}"`);
          } catch(e){
            console.warn('Failed to set default device with nircmd:', e);
          }
        }
    }
      // ensure ffplay exists and advise if missing
      const hasFfplay = await executableExists('ffplay');
      if (!hasFfplay){
        dialog.showErrorBox('Playback missing', 'ffplay (from ffmpeg) is required to play audio. Install ffmpeg and make sure ffplay is in your PATH.');
      } else {
        try {
          await execPromise(`ffplay -nodisp -autoexit -loglevel quiet "${tmpfile}"`);
        } catch (e) {
          console.warn('ffplay playback failed:', e);
        }
      }
  }

  try { fs.unlinkSync(tmpfile); } catch (e) {}
}

app.whenReady().then(async ()=>{
  await ensurePulseSink();
  createWindow();
  app.on('activate', function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

ipcMain.handle('speak', async (event, text) => {
  try {
    await speakText(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('get-config', async ()=>{
  return loadConfig();
});

ipcMain.handle('set-config', async (event, cfg)=>{
  const ok = saveConfig(cfg);
  return { ok };
});

ipcMain.handle('test-nircmd', async ()=>{
  const cfg = loadConfig();
  if (!cfg || !cfg.nircmdPath || !cfg.deviceName) return { ok: false, error: 'Please set nircmd path and device name in settings.' };
  try{
    const cmd = `"${cfg.nircmdPath}" setdefaultsounddevice "${cfg.deviceName}"`;
    const res = await execPromise(cmd);
    return { ok: true, stdout: res.stdout };
  } catch(e){
    return { ok: false, error: (e && e.err && e.err.message) ? e.err.message : String(e) };
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
