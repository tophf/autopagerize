export {
  applyPerSite,
  updateSpecificity,
};

import {arrayOrDummy, execScript, getSettings, inBG} from '/util/common.js';
import {$, $$} from '/util/dom.js';
import * as popup from './popup.js';

$('#excludeSection').addEventListener('click', updateSpecificity, {once: true});

async function exclude(e) {
  e.preventDefault();

  const pattern = e.target.title;
  await applyPerSite(pattern);

  const runTerminate = {
    code: `(${() => {
      if (typeof run === 'function')
        window.run({terminate: true});
    }})()`,
  };

  let path = chrome.runtime.getManifest().browser_action.default_popup;
  if (!path.startsWith('/'))
    path = '/' + path;

  for (const {id: tabId} of await findExcludedTabs(pattern)) {
    await Promise.all([
      inBG.setIcon({tabId, type: 'off'}),
      execScript(tabId, runTerminate),
      new Promise(resolve => chrome.browserAction.setPopup({tabId, popup: path}, resolve)),
    ]);
  }

  location.assign(path);
}

async function applyPerSite(pattern, listType = 'exclusions') {
  const ss = await getSettings();
  const list = arrayOrDummy(ss[listType]);
  if (!list.includes(pattern)) {
    list.push(pattern);
    inBG.writeSettings({[listType]: list});
  }
}

function updateSpecificity() {
  const {url} = popup.tab;
  for (const el of $$('#specificity a')) {
    const {type} = el.dataset;
    el.title =
      type === 'url' ? url :
        type === 'prefix' ? url + '*' :
          type === 'domain' ? new URL(url).origin + '/*' : '';
    el.onclick = exclude;
  }
  $('#specificity').dataset.ready = '';
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
