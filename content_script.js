// Inject in-page script so it runs in page context
// Ask the background worker to inject the in-page script into the MAIN world.
// This avoids CSP/inline/script-src failures because chrome.scripting.executeScript
// runs the function directly in the page's JS context.
chrome.runtime.sendMessage({ type: 'ensureInjected' }, (resp) => {
  if (!resp || !resp.ok) console.warn('Injection failed or not confirmed', resp);
});


// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'setTTS'){
    // Request the background to fetch the TTS audio (avoids page CSP). Background returns ArrayBuffer.
    try{
      const text = msg.text || '';
      chrome.runtime.sendMessage({ type: 'fetchTTS', text }, (resp) => {
        if (!resp || !resp.ok){
          console.error('fetchTTS failed', resp);
          sendResponse({ ok: false, error: resp && resp.error });
          return;
        }
        try{
          let arr = resp.data; // expected ArrayBuffer
          const origType = typeof arr;

          // Normalize possible shapes (structured clone may vary across contexts)
          if (arr && typeof arr === 'object' && !(arr instanceof ArrayBuffer)){
            // If it's a Uint8Array-like (has data or numeric keys), try to build an ArrayBuffer
            if (arr.data && arr.data instanceof ArrayBuffer){
              arr = arr.data;
            } else if (Array.isArray(arr)){
              arr = (new Uint8Array(arr)).buffer;
            } else {
              // attempt to convert object with numeric keys
              try{
                const vals = Object.keys(arr).map(k => arr[k]);
                if (vals.length && typeof vals[0] === 'number') arr = (new Uint8Array(vals)).buffer;
              }catch(e){}
            }
          }

          if (!(arr instanceof ArrayBuffer)){
            console.warn('TTS response data not an ArrayBuffer (type:', origType, '). Attempting fallback.');
          }

          const mime = resp.mime || 'audio/mpeg';

          // Create Blob for a quick canPlayType test, then transfer the ArrayBuffer to the page (transferable)
          const blob = new Blob([arr], { type: mime });
          try{
            const testAudio = document.createElement('audio');
            const testUrl = URL.createObjectURL(blob);
            testAudio.src = testUrl;
            const can = testAudio.canPlayType(mime || 'audio/mpeg');
            console.log('TTS blob mime:', mime, 'canPlayType =>', can);
            URL.revokeObjectURL(testUrl);
            if (!can){
              console.warn('Browser reports it may not play this MIME type. Will still attempt transfer.');
            }
          } catch (e){
            console.warn('TTS test playback check failed', e);
          }

          // Ensure arr is an ArrayBuffer for transfer
          let transferBuf = arr;
          if (!(transferBuf instanceof ArrayBuffer)){
            try{ transferBuf = (new Uint8Array(arr)).buffer; }catch(e){ transferBuf = arr.buffer || transferBuf; }
          }

          // Transfer the raw ArrayBuffer to the page; the injected script will build a Blob and object URL there.
          try{
            window.postMessage({ direction: 'from-extension', type: 'setTTS', arrayBuffer: transferBuf, mime }, '*', [transferBuf]);
            sendResponse({ ok: true });
          } catch (e){
            // If transfer failed, fall back to posting a cloned blob (may fail on some pages)
            console.warn('Transfer to page failed, falling back to posting blob:', e);
            try{ window.postMessage({ direction: 'from-extension', type: 'setTTS', blob }, '*'); sendResponse({ ok: true }); }
            catch(ex){ console.error('Final fallback posting blob failed', ex); sendResponse({ ok: false, error: String(ex) }); }
          }
        } catch (e){
          console.error('Failed to forward TTS blob', e);
          sendResponse({ ok: false, error: String(e) });
        }
      });
    } catch (e){
      console.error('Failed to request fetchTTS', e);
      sendResponse({ ok: false, error: String(e) });
    }
    // indicate async response
    return true;
  }
  if (msg.type === 'setTTSBlob'){
    try{
      const blob = msg.blob;
      if (!blob) return sendResponse({ ok: false, error: 'no blob' });
      console.log('content_script setTTSBlob received, typeof blob=', typeof blob, 'instanceof Blob=', blob instanceof Blob);
      // If it's a real Blob, use arrayBuffer(); if it's an object shape, try to reconstruct
      const handleArrayBuffer = (ab, mime) => {
        try{
          window.postMessage({ direction: 'from-extension', type: 'setTTS', arrayBuffer: ab, mime: mime || 'audio/wav' }, '*', [ab]);
          sendResponse({ ok: true });
        } catch (e){
          console.warn('Transfer to page failed for setTTSBlob, falling back to posting blob', e);
          try{ window.postMessage({ direction: 'from-extension', type: 'setTTS', blob }, '*'); sendResponse({ ok: true }); }
          catch(ex){ console.error('Final fallback posting blob failed', ex); sendResponse({ ok: false, error: String(ex) }); }
        }
      };

      if (blob instanceof Blob && blob.arrayBuffer){
        blob.arrayBuffer().then((ab) => handleArrayBuffer(ab, blob.type)).catch(e => { console.error('Failed to read blob.arrayBuffer()', e); sendResponse({ ok: false, error: String(e) }); });
      } else if (blob && typeof blob === 'object'){
        // Try common structured clone shapes
        if (blob.data && blob.data instanceof ArrayBuffer){
          handleArrayBuffer(blob.data, blob.type);
        } else if (Array.isArray(blob)){
          handleArrayBuffer((new Uint8Array(blob)).buffer, 'audio/wav');
        } else {
          try{
            const vals = Object.keys(blob).map(k => blob[k]);
            if (vals.length && typeof vals[0] === 'number'){
              handleArrayBuffer((new Uint8Array(vals)).buffer, 'audio/wav');
            } else {
              console.error('Unrecognized blob-like object shape', blob);
              sendResponse({ ok: false, error: 'unrecognized blob shape' });
            }
          } catch (e){ console.error('Failed to reconstruct blob arrayBuffer', e); sendResponse({ ok: false, error: String(e) }); }
        }
      } else {
        sendResponse({ ok: false, error: 'unsupported blob type' });
      }
    } catch (e){
      console.error('Failed to forward TTS blob from popup', e);
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }
  if (msg.type === 'playTTS'){
    window.postMessage({ direction: 'from-extension', type: 'playTTS' }, '*');
    sendResponse({ ok: true });
  }
});
