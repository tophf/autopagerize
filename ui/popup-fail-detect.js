if (location.search) {
  document.documentElement.classList.add('failed-page');
  window.failedPage = true;
  chrome.tabs.query({active: true, currentWindow: true}, async ([tab]) => {
    const tabId = tab.id;
    const r = await chrome.scripting.executeScript({
      target: {tabId},
      func: () => {
        let wasLoaded;
        const {id} = chrome.runtime;
        const idCheck = id + ':terminated';
        const orphanTerminated = () => (wasLoaded = true);
        addEventListener(idCheck, orphanTerminated);
        dispatchEvent(new Event(id));
        removeEventListener(idCheck, orphanTerminated);
        return wasLoaded;
      },
    }).catch(() => {});
    if (r?.[0]?.result) {
      await chrome.runtime.sendMessage({action: 'reinject', data: {tabId, url: tab.url}});
      location.search = '';
    }
  });
}
