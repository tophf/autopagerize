/*
global $
global onDomLoaded
global getSettings
*/
'use strict';

Promise.all([
  getSettings(),
  onDomLoaded(),
]).then(([
  settings,
]) => {
  $.status.checked = settings.enabled !== false;
  $.status.onchange = toggle;
  $.loadGo.onclick = loadMore;
  renderStatus();
});

function renderStatus() {
  const enabled = $.status.checked;
  $.status.closest('[data-status]').dataset.status = enabled;
  $.statusText.textContent = chrome.i18n.getMessage(enabled ? 'on' : 'off');
}

async function toggle() {
  const settings = await getSettings();
  settings.enabled = $.status.checked;
  chrome.runtime.sendMessage({action: 'writeSettings', settings}, renderStatus);
}

async function loadMore() {
  $.loadRemain.textContent = '';
  chrome.runtime.onMessage.addListener(onMessage);
  const tabId = (await getActiveTab()).id;
  const sectionClass = $.loadGo.closest('section').classList;
  sectionClass.add('disabled');
  chrome.tabs.executeScript(tabId, {
    code: `
      typeof run === 'function' &&
      run({loadMore: ${$.loadNum.value}})
    `,
  });
  async function onMessage(msg, sender) {
    if (msg.action === 'pagesRemain' &&
        sender.tab && sender.tab.id === tabId) {
      $.loadRemain.textContent = msg.num
        ? msg.num + '...'
        : chrome.i18n.getMessage('done');
      if (!msg.num) {
        sectionClass.remove('disabled');
        chrome.runtime.onMessage.removeListener(onMessage);
      }
    }
  }
  function getActiveTab() {
    return new Promise(resolve =>
      chrome.tabs.query({active: true, currentWindow: true}, ([tab]) =>
        resolve(tab || {})));
  }
}
