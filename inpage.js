(() => {
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
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;

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

})();
