export {
  switchGlobalState,
};

import {
  executeScript,
} from '/util/common.js';

import {
  maybeProcess,
  observeNavigation,
} from './bg.js';

let busy, stopIt;

async function switchGlobalState(state) {
  if (busy) {
    stopIt = true;
    while (stopIt)
      await new Promise(setTimeout);
  }
  busy = true;
  stopIt = false;
  chrome.contextMenus.update('onOff', {checked: state});
  await (state ? activate() : deactivate());
  busy = false;
}

async function activate() {
  localStorage.enabled = '';
  observeNavigation();
  for (const {id, url} of await queryTabs()) {
    await maybeProcess({url, tabId: id, frameId: 0});
    if (stopIt) {
      stopIt = false;
      return;
    }
  }
}

async function deactivate() {
  localStorage.enabled = 'false';
  chrome.webNavigation.onCompleted.removeListener(maybeProcess);
  chrome.webNavigation.onHistoryStateUpdated.removeListener(maybeProcess);
  chrome.webNavigation.onReferenceFragmentUpdated.removeListener(maybeProcess);

  const code = `(${runTerminateInContentScript})()`;
  const bgIcon = await import('./bg-icon.js');
  for (const {id: tabId} of await queryTabs()) {
    bgIcon.setIcon({tabId, type: 'off'});
    executeScript(tabId, {code});
    if (stopIt) {
      stopIt = false;
      return;
    }
  }
}

function runTerminateInContentScript() {
  if (typeof run === 'function')
    window.run({terminate: true});
}

function queryTabs() {
  return new Promise(r => chrome.tabs.query({url: '*://*/*'}, r));
}
