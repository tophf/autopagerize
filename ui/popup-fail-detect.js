/** Not a module to ensure it runs as early as possible */
'use strict';

if (location.search) (async () => {
  document.documentElement.classList.add('failed-page');
  const [{url, id: tabId}] = await chrome.tabs.query({active: true, currentWindow: true});
  if (await chrome.tabs.sendMessage(tabId, ['checkOrphan'], {frameId: 0}).catch(() => 0)) {
    await chrome.runtime.sendMessage({action: 'reinject', data: {tabId, url}});
    location.search = '';
  }
})();
