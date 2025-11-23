// Inject in-page script so it runs in page context
(function(){
  const url = chrome.runtime.getURL('inpage.js');
  const s = document.createElement('script');
  s.src = url;
  s.onload = function(){ this.remove(); };
  (document.documentElement || document.head || document.body).appendChild(s);
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
