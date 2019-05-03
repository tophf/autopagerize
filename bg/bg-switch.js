export {
  switchGlobalState,
};

import {
  executeScript,
  ignoreLastError,
} from '/util/common.js';

import {
  maybeProcess,
  maybeProcessMain,
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
    await maybeProcessMain({url, tabId: id, frameId: 0});
    if (stopIt) {
      stopIt = false;
      return;
    }
  }
}

async function deactivate() {
  localStorage.enabled = 'false';
  chrome.webNavigation.onCompleted.removeListener(maybeProcessMain);
  chrome.webNavigation.onHistoryStateUpdated.removeListener(maybeProcess);
  chrome.webNavigation.onReferenceFragmentUpdated.removeListener(maybeProcess);

  const code = `(${runTerminateInContentScript})()`;
  for (const {id} of await queryTabs()) {
    chrome.pageAction.hide(id, ignoreLastError);
    chrome.pageAction.setIcon({tabId: id, path: '/icons/off/icon16.png'}, ignoreLastError);
    await executeScript(id, {code});
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
