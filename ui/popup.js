/** @type chrome.tabs.Tab */
export let tab = {};

import {loadSettings, inBG} from '/util/common.js';
import {$} from '/util/dom.js';
import {i18n} from '/util/locale.js';

chrome.tabs.query({active: true, currentWindow: true}, tabs => {
  tab = tabs[0];
  if (location.search) {
    renderFailure();
  } else {
    import('./popup-load-more.js');
    import('./popup-exclude.js');
  }
});

loadSettings().then(ss => {
  Object.assign($('#status'), {
    checked: ss.enabled,
    onchange: toggled,
  });
  renderStatus();
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

function renderStatus() {
  const enabled = $('#status').checked;
  $('#status').closest('[data-status]').dataset.status = enabled;
  $('#statusText').textContent = i18n(enabled ? 'on' : 'off');
}

async function renderFailure() {
  const url = tab.url;
  const isWebUrl = url.startsWith('http');
  if (isWebUrl)
    inBG.tryGenericRules(tab.id).then(ok =>
      ok && import('./popup-generic-rules.js'));
  $('#failure').textContent = i18n(
    !isWebUrl ?
      'failedUnsupported' :
      await inBG.isUrlExcluded(url) ?
        'failedExcluded' :
        'failedUnpageable');
}

function toggled() {
  inBG.switchGlobalState($('#status').checked);
  renderStatus();
}
