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
