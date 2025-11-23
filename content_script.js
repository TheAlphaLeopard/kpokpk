// Inject in-page script so it runs in page context
(function(){
  // Inline the inpage script to avoid chrome-extension:// fetch/CSP issues.
  const code = `(() => {
  // Runs in page context
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
        // Build Google Translate TTS URL
        const q = encodeURIComponent(text);
        const url = \`https://translate.google.com/translate_tts?ie=UTF-8&q=\${q}&tl=en&client=tw-ob\`;

        // Create or reuse audio element
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

        // If we haven't created a source node for the audio element, create it now
        if (!elementSource){
          try{
            elementSource = audioCtx.createMediaElementSource(audioEl);
            elementSource.connect(destination);
          } catch (e){
            console.warn('createMediaElementSource failed', e);
            // If creation fails, we still attempt to play audio directly (may not be capturable)
          }
        }

        try{
          await audioEl.play();
          console.log('Playing TTS audio element');
        } catch (e){
          console.warn('audioEl.play() failed, user interaction may be required', e);
        }
      }
    } catch (e){
      console.error('Inpage handling error', e);
    }
  });

  // override getUserMedia to return our TTS stream when audio is requested
  try{
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      const origGet = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async function(constraints){
        // if audio requested and we have ttsStream, return it
        const wantsAudio = constraints && (constraints.audio === true || typeof constraints.audio === 'object');
        if (wantsAudio && ttsStream){
          return ttsStream;
        }
        return origGet(constraints);
      };
      console.log('TTS Virtual Mic: navigator.mediaDevices.getUserMedia overridden');
    }
  } catch (e){ console.warn('Could not override getUserMedia', e); }

})();`;

  const s = document.createElement('script');
  s.textContent = code + '\n//# sourceURL=inpage.js';
  (document.documentElement || document.head || document.body).appendChild(s);
  s.parentNode && s.parentNode.removeChild(s);
})();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'setTTS'){
    // Forward the text to the in-page script; in-page will create an <audio> element
    try{
      const text = msg.text || '';
      window.postMessage({ direction: 'from-extension', type: 'setTTS', text }, '*');
      sendResponse({ ok: true });
    } catch (e){
      console.error('Failed to forward TTS text', e);
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }
  if (msg.type === 'playTTS'){
    window.postMessage({ direction: 'from-extension', type: 'playTTS' }, '*');
    sendResponse({ ok: true });
  }
});
