'use strict';

/** @type chrome.tabs.Tab */
let tab;

Promise.all([
  getSettings(),
  getActiveTab(),
  onDomLoaded(),
]).then(([
  settings,
  tab_,
]) => {
  tab = tab_;
  $.status.checked = settings.enabled !== false;
  $.status.onchange = toggle;
  $.openOptions.onclick = e => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };
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

function getActiveTab() {
  return new Promise(resolve =>
    chrome.tabs.query({active: true, currentWindow: true}, tabs =>
      resolve(tabs[0])));
}
