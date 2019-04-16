/*
global $
global onDomLoaded
global chromeSync
global dispatchMessageAll
global ensureObject
*/
'use strict';

Promise.all([
  chromeSync.get('settings').then(ensureObject),
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
  const settings = ensureObject(await chromeSync.get('settings'));
  settings.disable = !$.status.checked;
  chromeSync.set({settings});
  dispatchMessageAll(settings.disable ? 'disableRequest' : 'enableRequest');
  window.close();
}
