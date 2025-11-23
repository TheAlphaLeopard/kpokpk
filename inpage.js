(() => {
  // Runs in page context
  let audioCtx = null;
  let ttsBuffer = null;
  let destination = null;
  let ttsStream = null;

  window.addEventListener('message', async (ev) => {
    const m = ev.data;
    if (!m || m.direction !== 'from-extension') return;
    try{
      if (m.type === 'setTTS'){
        const ab = m.audioBuffer;
        if (!ab) return;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // decode audio data
        ttsBuffer = await audioCtx.decodeAudioData(ab.slice(0));
        console.log('TTS buffer received, duration', ttsBuffer.duration);
      } else if (m.type === 'playTTS'){
        if (!ttsBuffer) return console.warn('No TTS buffer');
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!destination){
          destination = audioCtx.createMediaStreamDestination();
          ttsStream = destination.stream;
        }
        const src = audioCtx.createBufferSource();
        src.buffer = ttsBuffer;
        src.connect(destination);
        src.start();
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
