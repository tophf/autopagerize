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
  const pattern = e.target.title;
  const exclusions = arrayOrDummy(ss.exclusions);
  if (!exclusions.includes(pattern)) {
    exclusions.push(pattern);
    inBG.writeSettings({exclusions});
  }

  let path = chrome.runtime.getManifest().browser_action.default_popup;
  if (!path.startsWith('/'))
    path = '/' + path;

  for (const {id: tabId} of await findExcludedTabs(pattern)) {
    await Promise.all([
      inBG.setIcon({tabId, type: 'off'}),
      executeScript(tabId, terminateContentScript),
      new Promise(resolve => chrome.browserAction.setPopup({tabId, popup: path}, resolve)),
    ]);
  }

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

function findExcludedTabs(pattern) {
  const isPrefix = pattern.endsWith('*');
  const url = isPrefix ? pattern.slice(0, -1) : pattern;
  // the API can't query #hash and may return tabs with a #different-hash
  // so we need to get all tabs with the same base URL and then filter the results
  const hashlessUrl = pattern.split('#', 1)[0] + (isPrefix ? '*' : '');
  return new Promise(resolve =>
    chrome.tabs.query({url: hashlessUrl}, tabs => {
      tabs = isPrefix
        ? tabs.filter(t => t.url.startsWith(url))
        : tabs.filter(t => t.url === url);
      resolve(tabs);
    }));
}

function terminateContentScript() {
  window.launched = false;
  if (typeof run === 'function')
    window.run({terminate: true});
}
