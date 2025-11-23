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
          const arr = resp.data; // ArrayBuffer
          const mime = resp.mime || 'audio/mpeg';
          const blob = new Blob([arr], { type: mime });
          // Forward the blob to the page; injected script will create an object URL from it.
          window.postMessage({ direction: 'from-extension', type: 'setTTS', blob }, '*');
          sendResponse({ ok: true });
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
  if (msg.type === 'playTTS'){
    window.postMessage({ direction: 'from-extension', type: 'playTTS' }, '*');
    sendResponse({ ok: true });
  }
});
