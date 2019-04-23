'use strict';

let tabId;

Promise.all([
  getSettings(),
  onDomLoaded(),
]).then(([
  settings,
]) => {
  $.status.checked = settings.enabled !== false;
  $.status.onchange = toggle;
  $.loadGo.onclick = loadMore;
  $.loadStop.onclick = loadStop;
  renderStatus();
});

function renderStatus() {
  const enabled = $.status.checked;
  $.status.closest('[data-status]').dataset.status = enabled;
  $.statusText.textContent = chrome.i18n.getMessage(enabled ? 'on' : 'off');
}

async function toggle() {
  inBG.writeSettings({
    ...await getSettings(),
    enabled: $.status.checked,
  });
  renderStatus();
}

function loadMore() {
  $.loadRemain.textContent = '';
  $.loadGo.closest('section').classList.add('disabled');
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
    tabId = tab.id;
    execScript($.loadNum.value);
  });
}

/**
 * @param {Event} [event] - omit it to skip executeScript when calling explicitly
 */
function loadStop(event) {
  $.loadGo.closest('section').classList.remove('disabled');
  chrome.runtime.onMessage.removeListener(onMessage);
  if (event)
    execScript(-1);
}

function onMessage(msg, sender) {
  if (msg.action === 'pagesRemain' &&
      sender.tab && sender.tab.id === tabId) {
    const num = msg.data;
    $.loadRemain.textContent = num ? num + '...' : chrome.i18n.getMessage('done');
    if (!num)
      loadStop();
  }
}

function execScript(data) {
  chrome.tabs.executeScript(tabId, {
    code: `
      typeof run === 'function' &&
      run({loadMore: ${data}})
    `,
  }, ignoreLastError);
}
