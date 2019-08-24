/** @type chrome.tabs.Tab */
export let tab = {};

import {getSettings, inBG, isAppEnabled} from '/util/common.js';
import {$, onDomLoaded} from '/util/dom.js';
import {i18n} from '/util/locale.js';

chrome.tabs.query({active: true, currentWindow: true}, tabs => {
  tab = tabs[0];
  dispatchEvent(new Event('gotTab'));
  if (window.failedPage && $('#failure'))
    renderFailure();
});

onDomLoaded().then(() => {
  Object.assign($('#status'), {
    checked: isAppEnabled(),
    onchange: toggled,
  });
  Object.assign($('#hotkeys'), {
    onclick(e) {
      chrome.tabs.create({url: this.href});
      e.preventDefault();
    },
  });
  Object.assign($('#openOptions'), {
    onclick(e) {
      chrome.runtime.openOptionsPage();
      e.preventDefault();
    },
  });
  renderStatus();
  if (window.failedPage && tab.url) {
    renderFailure();
    return;
  }
  import('./popup-load-more.js');
  import('./popup-exclude.js');
});

function renderStatus() {
  const enabled = $('#status').checked;
  $('#status').closest('[data-status]').dataset.status = enabled;
  $('#statusText').textContent = i18n(enabled ? 'on' : 'off');
}

async function renderFailure() {
  const url = tab.url;
  const isWebUrl = url.startsWith('http');
  if (isWebUrl)
    inBG.tryGenericRules({tabId: tab.id, url}).then(ok =>
      ok && import('./popup-generic-rules.js'));
  $('#failure').textContent = i18n(
    !isWebUrl ?
      'failedUnsupported' :
      await inBG.isUrlExcluded(url, await getSettings('exclusions')) ?
        'failedExcluded' :
        'failedUnpageable');
}

function toggled() {
  inBG.switchGlobalState($('#status').checked);
  renderStatus();
}
