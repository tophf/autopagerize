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
