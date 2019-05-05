chrome.runtime.sendMessage({action: 'keepAlive'}, () => {
  top.document.getElementsByTagName('iframe')[0].remove();
  return chrome.runtime.lastError;
});
