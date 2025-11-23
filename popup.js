document.getElementById('set').addEventListener('click', async ()=>{
  const text = document.getElementById('text').value || '';
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) return alert('No active tab');
  chrome.tabs.sendMessage(tabs[0].id, { type: 'setTTS', text }, (resp)=>{
    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
    // optional: show response
  });
});

document.getElementById('play').addEventListener('click', async ()=>{
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) return alert('No active tab');
  chrome.tabs.sendMessage(tabs[0].id, { type: 'playTTS' }, (resp)=>{
    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
  });
});

document.getElementById('setSpeak').addEventListener('click', async ()=>{
  const text = document.getElementById('text').value || '';
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) return alert('No active tab');
  const tabId = tabs[0].id;

  // Send setTTS, then on success send playTTS
  chrome.tabs.sendMessage(tabId, { type: 'setTTS', text }, (resp) => {
    if (chrome.runtime.lastError) {
      console.warn('setTTS error:', chrome.runtime.lastError.message);
      return;
    }
    // small delay to ensure audio element loads, but also trigger play immediately
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'playTTS' }, (r2) => {
        if (chrome.runtime.lastError) console.warn('playTTS error:', chrome.runtime.lastError.message);
      });
    }, 200);
  });
});
