// Background service worker: inject in-page code into the tab's main world.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
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

          window.addEventListener('message', async (ev) => {
            const m = ev.data;
            if (!m || m.direction !== 'from-extension') return;
            try{
              if (m.type === 'setTTS'){
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
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
              const origGet = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
              navigator.mediaDevices.getUserMedia = async function(constraints){
                const wantsAudio = constraints && (constraints.audio === true || typeof constraints.audio === 'object');
                if (wantsAudio && ttsStream){
                  return ttsStream;
                }
                return origGet(constraints);
              };
              console.log('TTS Virtual Mic: navigator.mediaDevices.getUserMedia overridden');
            }
          } catch (e){ console.warn('Could not override getUserMedia', e); }
        })();
      }
    }).then(()=> sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: String(err) }));
    // indicate async response
    return true;
  }
});
