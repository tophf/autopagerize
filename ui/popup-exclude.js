import * as popup from './popup.js';

import {
  arrayOrDummy,
  executeScript,
  getSettings,
  inBG,
} from '/util/common.js';

import {$} from '/util/dom.js';

if (popup.tab.url)
  updateTitles();
else
  addEventListener('gotTab', updateTitles, {once: true});

async function exclude(e) {
  e.preventDefault();

  const ss = await getSettings();
  const exclusions = arrayOrDummy(ss.exclusions);
  if (!exclusions.includes(e.target.title)) {
    exclusions.push(e.target.title);
    inBG.writeSettings({exclusions});
  }

  const tabId = popup.tab.id;
  let path = chrome.runtime.getManifest().browser_action.default_popup;
  if (!path.startsWith('/'))
    path = '/' + path;

  await Promise.all([
    inBG.setIcon({tabId, type: 'off'}),
    executeScript(tabId, () => typeof run === 'function' && window.run({terminate: true})),
    new Promise(resolve => chrome.browserAction.setPopup({tabId, popup: path}, resolve)),
  ]);

  location.assign(path);
}

function updateTitles() {
  const {url} = popup.tab;
  for (const el of $.excludeSection.querySelectorAll('a')) {
    const {type} = el.dataset;
    el.title =
      type === 'url' ? url :
        type === 'prefix' ? url + '*' :
          type === 'domain' ? new URL(url).origin + '/*' : '';
    el.onclick = exclude;
  }
}
