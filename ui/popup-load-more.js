/* global tab */
'use strict';

(async () => {
  $.loadGo.onclick = run;
  $.loadStop.onclick = stop;
  if (await query() > 0) {
    renderState(true);
    chrome.runtime.onMessage.addListener(onMessage);
  }

  function run() {
    $.loadRemain.textContent = '';
    renderState(true);
    inTab($.loadNum.value);
    chrome.runtime.onMessage.addListener(onMessage);
  }

  /**
   * @param {Event} [event] - omit it to skip executeScript when calling explicitly
   */
  function stop(event) {
    renderState(false);
    chrome.runtime.onMessage.removeListener(onMessage);
    if (event)
      inTab('stop');
  }

  function inTab(data) {
    chrome.tabs.executeScript(tab.id, {
      code: `
        typeof run === 'function' &&
        run({loadMore: ${data}})
      `,
    }, ignoreLastError);
  }

  function query() {
    return new Promise(resolve =>
      chrome.tabs.executeScript({
        code: `
          typeof run === 'function' &&
          run({loadMore: 'query'})
        `,
      }, r => {
        resolve(chrome.runtime.lastError ? 0 : r[0]);
      }));
  }

  function onMessage(msg, sender) {
    if (msg.action === 'pagesRemaining' &&
        sender.tab && sender.tab.id === tab.id) {
      const num = msg.data;
      $.loadRemain.textContent = num ? num + '...' : i18n('done');
      if (!num)
        stop();
    }
  }

  function renderState(running) {
    $.loadGo.closest('section').classList.toggle('disabled', running);
  }
})();
