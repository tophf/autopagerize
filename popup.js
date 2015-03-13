/*
global onDomLoaded
global chromeStorage
global dispatchMessageAll
global ensureObject
*/
'use strict';

Promise.all([
  chromeStorage.settings.then(ensureObject),
  onDomLoaded(),
]).then(([
  settings,
]) => {
  $.status.checked = !settings.disable;
  $.statusText.textContent = chrome.i18n.getMessage(settings.disable ? 'off' : 'on');
  $.statusText.closest('label').style.color = settings.disable ? 'darkred' : 'darkgreen';
  $.status.onchange = toggle;
});

async function toggle() {
  const settings = ensureObject(await chromeStorage.settings);
  settings.disable = !$.status.checked;
  chromeStorage.settings = settings;
  dispatchMessageAll(settings.disable ? 'disableRequest' : 'enableRequest');
  window.close();
}
