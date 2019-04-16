/*
global $
global onDomLoaded
global chromeSync
*/
'use strict';

Promise.all([
  chromeSync.getObject('settings'),
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
  const settings = await chromeSync.getObject('settings');
  settings.disable = !$.status.checked;
  await chromeSync.set({settings});
  window.close();
}
