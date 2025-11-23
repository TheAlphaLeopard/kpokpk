const textEl = document.getElementById('text');
const btn = document.getElementById('speak');
const status = document.getElementById('status');
const platformNote = document.getElementById('platformNote');
const deviceNameEl = document.getElementById('deviceName');
const nircmdPathEl = document.getElementById('nircmdPath');
const autoSetEl = document.getElementById('autoSet');
const saveBtn = document.getElementById('saveSettings');
const saveStatus = document.getElementById('saveStatus');
const testBtn = document.getElementById('testNircmd');
const testStatus = document.getElementById('testStatus');

function renderPlatformNote(){
  const p = window.api.platform || 'unknown';
  if (p === 'win32'){
    platformNote.innerHTML = `
      <strong>Windows instructions:</strong> Install VB-Audio Virtual Cable ("VB-Cable"). Set the "CABLE Input" device as your default Playback device or route app output to it. Download: https://vb-audio.com/Cable/
      <div style="margin-top:6px">
        <button id="copyCmd">Copy optional nircmd command</button>
        <small style="display:block;margin-top:6px;color:#666">If you install <em>nircmd</em> you can set the default playback device from the command line. Substitute your device name.</small>
      </div>
    `;
    const copyBtn = document.getElementById('copyCmd');
    if (copyBtn) copyBtn.addEventListener('click', ()=>{
      const cmd = 'nircmd setdefaultsounddevice "CABLE Input (VB-Audio Virtual Cable)"';
      navigator.clipboard.writeText(cmd).then(()=>{
        status.textContent = 'Copied nircmd command to clipboard.';
        setTimeout(()=> status.textContent = '', 3000);
      });
    });
  } else if (p === 'linux'){
    platformNote.textContent = 'Linux: the app will try to create a PulseAudio sink named TTS_SINK automatically.';
  } else {
    platformNote.textContent = `Platform: ${p}. See README for platform-specific steps.`;
  }
}

renderPlatformNote();

async function loadSettings(){
  try{
    const cfg = await window.api.getConfig();
    if (cfg){
      deviceNameEl.value = cfg.deviceName || '';
      nircmdPathEl.value = cfg.nircmdPath || '';
      autoSetEl.checked = !!cfg.autoSet;
    }
  } catch(e){ console.warn('Failed to load settings', e); }
}

saveBtn.addEventListener('click', async ()=>{
  const cfg = { deviceName: deviceNameEl.value.trim(), nircmdPath: nircmdPathEl.value.trim(), autoSet: !!autoSetEl.checked };
  try{
    const res = await window.api.setConfig(cfg);
    if (res && res.ok){
      saveStatus.textContent = 'Saved';
      setTimeout(()=> saveStatus.textContent = '', 2000);
    } else {
      saveStatus.textContent = 'Failed to save';
      setTimeout(()=> saveStatus.textContent = '', 2000);
    }
  } catch(e){ saveStatus.textContent = 'Failed'; setTimeout(()=> saveStatus.textContent = '', 2000); }
});

loadSettings();

testBtn.addEventListener('click', async ()=>{
  testStatus.textContent = 'Testing...';
  try{
    const res = await window.api.testNircmd();
    if (res && res.ok){
      testStatus.textContent = 'Success';
    } else {
      testStatus.textContent = 'Failed: ' + (res && res.error ? res.error : 'unknown');
    }
  } catch(e){
    testStatus.textContent = 'Error: ' + String(e);
  }
  setTimeout(()=> testStatus.textContent = '', 4000);
});

btn.addEventListener('click', async ()=>{
  const txt = textEl.value;
  status.textContent = 'Speaking...';
  btn.disabled = true;
  try {
    const res = await window.api.speak(txt);
    if (res.ok) status.textContent = 'Done.';
    else status.textContent = 'Error: ' + (res.error || 'unknown');
  } catch (err) {
    status.textContent = 'Error: ' + String(err);
  }
  btn.disabled = false;
  setTimeout(()=> status.textContent = '', 4000);
});
