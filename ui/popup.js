/** @type chrome.tabs.Tab */
export let tab;

import {
  inBG,
  isGloballyEnabled,
} from '/util/common.js';

import {
  $,
  onDomLoaded,
} from '/util/dom.js';

import {i18n} from '/util/locale.js';

chrome.tabs.query({active: true, currentWindow: true}, tabs => {
  tab = tabs[0];
});

onDomLoaded().then(() => {
  $.status.checked = isGloballyEnabled();
  $.status.onchange = toggled;
  $.hotkeys.onclick = function (e) {
    chrome.tabs.create({url: this.href});
    e.preventDefault();
  };
  $.openOptions.onclick = e => {
    chrome.runtime.openOptionsPage();
    e.preventDefault();
  };
  renderStatus();
  import('./popup-load-more.js');
  import('./popup-exclude.js');
});

function renderStatus() {
  const enabled = $.status.checked;
  $.status.closest('[data-status]').dataset.status = enabled;
  $.statusText.textContent = i18n(enabled ? 'on' : 'off');
}

function toggled() {
  inBG.switchGlobalState($.status.checked);
  renderStatus();
}
