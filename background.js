// Background service worker: inject in-page code into the tab's main world.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  // Background fetch for TTS audio (content_script will forward blob to the page)
  if (msg.type === 'fetchTTS'){
    (async () => {
      try{
        const text = msg.text || '';
        if (!text) return sendResponse({ ok: false, error: 'No text' });
        const q = encodeURIComponent(text);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error('TTS fetch failed: ' + res.status);
        const buf = await res.arrayBuffer();
        const mime = res.headers.get('content-type') || 'audio/mpeg';
        sendResponse({ ok: true, data: buf, mime });
      } catch (e){
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'ensureInjected'){
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) return;
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: function(){
        // This function runs in the page (MAIN) world.
        if (window.__tts_virtual_mic_injected) return;
        window.__tts_virtual_mic_injected = true;

        (function(){
          let audioCtx = null;
          let audioEl = null;
          let elementSource = null;
          let destination = null;
          let ttsStream = null;
          const _pokpok_fake_device_id = 'pokpok-tts-virtual-device';

          window.addEventListener('message', async (ev) => {
            const m = ev.data;
            if (!m || m.direction !== 'from-extension') return;
            try{
              if (m.type === 'setTTS'){
                // Accept either an ArrayBuffer (preferred), a Blob, or raw text (fallback).
                if (m.arrayBuffer){
                  console.log('Inpage received transferred arrayBuffer, mime=', m.mime, 'arrayBuffer instanceof ArrayBuffer=', m.arrayBuffer instanceof ArrayBuffer);
                  try{
                    if (!audioEl){
                      audioEl = document.createElement('audio');
                      audioEl.crossOrigin = 'anonymous';
                      audioEl.style.display = 'none';
                      document.body.appendChild(audioEl);
                    }
                    try{ if (audioEl._objectUrl) URL.revokeObjectURL(audioEl._objectUrl); }catch(e){}
                    const blob = new Blob([m.arrayBuffer], { type: m.mime || 'audio/mpeg' });
                    let objectUrl;
                    try{
                      objectUrl = URL.createObjectURL(blob);
                    } catch (e){
                      console.error('createObjectURL failed in page context', e, 'blob type=', blob.type);
                      throw e;
                    }
                    audioEl._objectUrl = objectUrl;
                    audioEl.src = objectUrl;
                    audioEl.load();
                    console.log('TTS audio element set from transferred ArrayBuffer, objectUrl=', objectUrl);
                  } catch (e){ console.error('Failed to use transferred ArrayBuffer', e); }
                } else if (m.blob){
                  console.log('Inpage received m.blob, typeof=', typeof m.blob, 'm.blob instanceof Blob=', m.blob instanceof Blob);
                  if (!audioEl){
                    audioEl = document.createElement('audio');
                    audioEl.crossOrigin = 'anonymous';
                    audioEl.style.display = 'none';
                    document.body.appendChild(audioEl);
                  }
                  try{
                    if (audioEl._objectUrl) URL.revokeObjectURL(audioEl._objectUrl);
                  }catch(e){}
                  const objectUrl = URL.createObjectURL(m.blob);
                  audioEl._objectUrl = objectUrl;
                  audioEl.src = objectUrl;
                  audioEl.load();
                  console.log('TTS audio element set from blob');
                } else {
                  const text = m.text || '';
                  if (!text) return;
                  const q = encodeURIComponent(text);
                  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;
                  if (!audioEl){
                    audioEl = document.createElement('audio');
                    audioEl.crossOrigin = 'anonymous';
                    audioEl.style.display = 'none';
                    document.body.appendChild(audioEl);
                  }
                  audioEl.src = url;
                  audioEl.load();
                  console.log('TTS audio element set src', url);
                }
              } else if (m.type === 'playTTS'){
                if (!audioEl) return console.warn('No audio element prepared');
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (!destination){
                  destination = audioCtx.createMediaStreamDestination();
                  ttsStream = destination.stream;
                }
                if (!elementSource){
                  try{
                    elementSource = audioCtx.createMediaElementSource(audioEl);
                    elementSource.connect(destination);
                  } catch (e){
                    console.warn('createMediaElementSource failed', e);
                  }
                }
                try{
                  await audioEl.play();
                  console.log('Playing TTS audio element');
                } catch (e){
                  console.warn('audioEl.play() failed, user interaction may be required', e);
                }
              }
            } catch (e){ console.error('Inpage handling error', e); }
          });

          try{
            if (navigator.mediaDevices){
              // Override enumerateDevices to advertise a fake audio input named "pokpok tts".
              try{
                const origEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
                navigator.mediaDevices.enumerateDevices = async function(){
                  const devices = await origEnumerate();
                  try{
                    devices.push({
                      deviceId: _pokpok_fake_device_id,
                      kind: 'audioinput',
                      label: 'pokpok tts',
                      groupId: ''
                    });
                  }catch(e){ /* ignore if device list is frozen */ }
                  return devices;
                };
                console.log('TTS Virtual Mic: enumerateDevices overridden');
              } catch (e){ console.warn('Could not override enumerateDevices', e); }

              if (navigator.mediaDevices.getUserMedia){
                const origGet = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                navigator.mediaDevices.getUserMedia = async function(constraints){
                  const wantsAudio = constraints && (constraints.audio === true || typeof constraints.audio === 'object');
                  let requestedDeviceId = null;
                  if (wantsAudio && typeof constraints.audio === 'object'){
                    const dev = constraints.audio.deviceId;
                    if (dev){
                      if (typeof dev === 'string') requestedDeviceId = dev;
                      else if (typeof dev === 'object' && (dev.exact || dev.ideal)) requestedDeviceId = dev.exact || dev.ideal;
                    }
                  }

                  // If the page explicitly requests the fake device, or wants audio but didn't request a different device,
                  // return our TTS MediaStream when available.
                  if (wantsAudio && (requestedDeviceId === _pokpok_fake_device_id || requestedDeviceId === null)){
                    if (ttsStream){
                      console.log('TTS Virtual Mic: returning TTS stream for getUserMedia', requestedDeviceId);
                      return ttsStream;
                    }
                  }
                  return origGet(constraints);
                };
                console.log('TTS Virtual Mic: navigator.mediaDevices.getUserMedia overridden');
              }
            }
          } catch (e){ console.warn('Could not override mediaDevices APIs', e); }

        })();
      }
    }).then(()=> sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: String(err) }));
    // indicate async response
    return true;
  }
});
