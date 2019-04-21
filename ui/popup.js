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
  renderStatus();
});

function renderStatus() {
  const enabled = $.status.checked;
  $.statusText.textContent = chrome.i18n.getMessage(enabled ? 'on' : 'off');
  $.statusText.closest('label').style.opacity = enabled ? 1 : .5;
}

async function toggle() {
  const settings = await getSettings();
  settings.enabled = $.status.checked;
  chrome.runtime.sendMessage({action: 'writeSettings', settings}, renderStatus);
}
