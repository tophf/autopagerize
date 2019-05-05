// check if redirected from popup-fail.html
if (new URLSearchParams(location.search).has('fail')) {
  document.documentElement.classList.add('failed-page');
  window.failedPage = true;
  chrome.tabs.executeScript({
    code: `(${() => {
      let wasLoaded;
      const id = chrome.runtime.id;
      const idCheck = id + 'terminated';
      const orphanTerminated = () => (wasLoaded = true);
      addEventListener(idCheck, orphanTerminated);
      dispatchEvent(new Event(id));
      removeEventListener(idCheck, orphanTerminated);
      return wasLoaded;
    }})()`,
  }, r => {
    if (!chrome.runtime.lastError && r && r[0])
      chrome.runtime.sendMessage({action: 'reinject'}, () =>
        location.assign('/ui/popup.html'));
  });
}
