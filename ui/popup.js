/** @type chrome.tabs.Tab */
export let tab = {};

import {
  getSettings,
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
  dispatchEvent(new Event('gotTab'));
  if (window.failedPage && $.failure)
    renderFailure();
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
  if (window.failedPage && tab.url) {
    renderFailure();
    return;
  }
  import('./popup-load-more.js');
  import('./popup-exclude.js');
});

function renderStatus() {
  const enabled = $.status.checked;
  $.status.closest('[data-status]').dataset.status = enabled;
  $.statusText.textContent = i18n(enabled ? 'on' : 'off');
}

async function renderFailure() {
  let msg;
  if (!tab.url.startsWith('http'))
    msg = 'failedUnsupported';
  else {
    const [{exclusions}, bgUtil] = await Promise.all([getSettings(), import('/bg/bg-util.js')]);
    msg = await bgUtil.isUrlExcluded(tab.url, exclusions) ? 'failedExcluded' : 'failedUnpageable';
  }
  $.failure.textContent = i18n(msg);
}

function toggled() {
  inBG.switchGlobalState($.status.checked);
  renderStatus();
}
