'use strict';

let tabId;

const loadMore = {

  init() {
    chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
      tabId = tab.id;
    });

    Promise.all([
      loadMore.query(),
      onDomLoaded(),
    ]).then(([
      remaining,
    ]) => {
      $.loadGo.onclick = loadMore.run;
      $.loadStop.onclick = loadMore.stop;
      if (remaining > 0) {
        loadMore.renderState(true);
        chrome.runtime.onMessage.addListener(loadMore.onMessage);
      }
    });
  },

  run() {
    $.loadRemain.textContent = '';
    loadMore.renderState(true);
    loadMore.inTab($.loadNum.value);
    chrome.runtime.onMessage.addListener(loadMore.onMessage);
  },

  /**
   * @param {Event} [event] - omit it to skip executeScript when calling explicitly
   */
  stop(event) {
    loadMore.renderState(false);
    chrome.runtime.onMessage.removeListener(loadMore.onMessage);
    if (event)
      loadMore.inTab('stop');
  },

  inTab(data) {
    chrome.tabs.executeScript(tabId, {
      code: `
        typeof run === 'function' &&
        run({loadMore: ${data}})
      `,
    }, ignoreLastError);
  },

  query() {
    return new Promise(resolve =>
      chrome.tabs.executeScript({
        code: `
          typeof run === 'function' &&
          run({loadMore: 'query'})
        `,
      }, r => {
        resolve(chrome.runtime.lastError ? 0 : r[0]);
      }));
  },

  onMessage(msg, sender) {
    if (msg.action === 'pagesRemaining' &&
        sender.tab && sender.tab.id === tabId) {
      const num = msg.data;
      $.loadRemain.textContent = num ? num + '...' : chrome.i18n.getMessage('done');
      if (!num)
        loadMore.stop();
    }
  },

  renderState(running) {
    $.loadGo.closest('section').classList.toggle('disabled', running);
  },
};

loadMore.init();
