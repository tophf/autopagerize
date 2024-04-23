export {
  applyPerSite,
  updateSpecificity,
};

import {arrayOrDummy, inBG, loadSettings, tabSend} from '/util/common.js';
import {$, $$} from '/util/dom.js';
import * as popup from './popup.js';

$('#excludeSection').addEventListener('click', updateSpecificity, {once: true});

async function exclude(e) {
  e.preventDefault();

  const pattern = e.target.url;
  await applyPerSite(pattern);

  let path = chrome.runtime.getManifest().action.default_popup;
  if (!path.startsWith('/'))
    path = '/' + path;

  for (const t of await findExcludedTabs(pattern)) {
    await Promise.all([
      inBG.setIcon({tabId: t.id, type: 'off'}),
      chrome.action.setPopup({tabId: t.id, popup: path}),
      !t.discarded && tabSend(t.id, ['run', {terminate: true}]),
    ]);
  }

  location.assign(path);
}

async function applyPerSite(pattern, listType = 'exclusions') {
  const list = arrayOrDummy(await loadSettings(listType));
  if (!list.includes(pattern)) {
    list.push(pattern);
    inBG.writeSettings({[listType]: list});
  }
}

function updateSpecificity() {
  const {url} = popup.tab;
  for (const el of $$('#specificity a')) {
    const {type} = el.dataset;
    el.title = decodeURIComponent(el.url =
      type === 'url' ? url :
        type === 'prefix' ? url + '*' :
          type === 'domain' ? new URL(url).origin + '/*' : ''
    );
    el.onclick = exclude;
  }
  $('#specificity').dataset.ready = '';
}

async function findExcludedTabs(pattern) {
  const isPrefix = pattern.endsWith('*');
  const url = isPrefix ? pattern.slice(0, -1) : pattern;
  // the API can't query #hash and may return tabs with a #different-hash
  // so we need to get all tabs with the same base URL and then filter the results
  const hashlessUrl = pattern.split('#', 1)[0] + (isPrefix ? '*' : '');
  const tabs = await chrome.tabs.query({url: hashlessUrl});
  return tabs.filter(t => isPrefix ? t.url.startsWith(url) : t.url === url);
}
