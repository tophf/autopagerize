import {tabSend} from '/util/common.js';
import {setIcon} from './bg-icon.js';
import {onNavigation, toggleNav} from './bg.js';
import {queryTabs} from './bg-util.js';

let busy, stopIt;

export async function switchGlobalState(state) {
  if (busy)
    await (stopIt = Promise.withResolvers()).promise;
  busy = true;
  stopIt = false;
  chrome.contextMenus.update('onOff', {checked: state});
  toggleNav(state);
  await (state ? activate() : deactivate());
  busy = false;
}

async function activate() {
  chrome.storage.sync.remove('enabled');
  for (const {id, url} of await queryTabs()) {
    await onNavigation({url, tabId: id, frameId: 0});
    if (stopIt) return stopIt.resolve();
  }
}

async function deactivate() {
  chrome.storage.sync.set({enabled: false});
  for (const t of await queryTabs()) {
    await setIcon({tabId: t.id, type: 'off'});
    if (!t.discarded)
      await tabSend(t.id, ['run', {terminate: true}]);
    if (stopIt)
      return stopIt.resolve();
  }
}
