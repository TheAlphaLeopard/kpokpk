// Inject in-page script so it runs in page context
(function(){
  const url = chrome.runtime.getURL('inpage.js');
  const s = document.createElement('script');
  s.src = url;
  s.onload = function(){ this.remove(); };
  (document.documentElement || document.head || document.body).appendChild(s);
})();

// Listen for messages from popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'setTTS'){
    // fetch TTS audio and forward to inpage via postMessage
    try{
      const text = msg.text || '';
      const q = encodeURIComponent(text);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;
      const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
      const ab = await res.arrayBuffer();
      // post to page context; use structured clone transfer
      window.postMessage({ direction: 'from-extension', type: 'setTTS', audioBuffer: ab }, '*', [ab]);
      sendResponse({ ok: true });
    } catch (e){
      console.error('Failed to fetch TTS', e);
      sendResponse({ ok: false, error: String(e) });
    }
    return true; // will respond asynchronously
  }
  if (msg.type === 'playTTS'){
    window.postMessage({ direction: 'from-extension', type: 'playTTS' }, '*');
    sendResponse({ ok: true });
  }
});
