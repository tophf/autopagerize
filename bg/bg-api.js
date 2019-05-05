import {
  DEFAULT_SETTINGS,
  executeScript,
  ignoreLastError,
  isGloballyEnabled,
} from '/util/common.js';

import {
  maybeProcess,
  settings,
} from './bg.js';

let _endpoints;
export const endpoints = () => _endpoints || initEndpoints();

chrome.contextMenus.create({
  id: 'onOff',
  type: 'checkbox',
  contexts: ['page_action', 'browser_action'],
  title: chrome.i18n.getMessage('onOff'),
  checked: isGloballyEnabled(),
}, ignoreLastError);

chrome.contextMenus.onClicked.addListener(onChromeMenu);
chrome.commands.onCommand.addListener(onChromeCommand);
chrome.runtime.onMessage.addListener(onRuntimeMessage);

function onChromeMenu(info) {
  endpoints().switchGlobalState(info.checked);
}

function onChromeCommand(cmd) {
  if (cmd === 'onOff') {
    endpoints().switchGlobalState(!isGloballyEnabled());
    return;
  }
  if (cmd.startsWith('loadMore')) {
    executeScript(
      null,
      num => typeof run === 'function' && window.run({loadMore: num}),
      Number(cmd.slice(-2)));
    return;
  }
}

function onRuntimeMessage(msg, sender, sendResponse) {
  const fn = endpoints()[msg.action];
  if (!fn)
    return;
  const result = fn(msg.data, sender);
  if (result && typeof result.then === 'function') {
    result.then(sendResponse);
    return true;
  }
  if (result !== undefined)
    sendResponse(result);
}

function initEndpoints() {
  _endpoints = Object.assign(Object.create(null), {

    launched: (_, sender) => {
      const tabId = sender.tab.id;
      chrome.browserAction.setPopup({tabId, popup: '/ui/popup.html'});
      import('./bg-icon.js').then(m => m.setIcon(tabId));
    },

    writeSettings: async ss => {
      await (await import('./bg-settings.js')).writeSettings(ss);
    },

    updateSiteinfo: async portName => {
      const port = chrome.runtime.connect({name: portName});
      const result = await (await import('./bg-update.js')).updateSiteinfo({
        force: true,
        onprogress: e => port.postMessage(e.loaded),
      });
      port.disconnect();
      return result >= 0 ? result : String(result);
    },

    switchGlobalState: async state => {
      await (await import('./bg-switch.js')).switchGlobalState(state);
    },

    keepAlive: () => {
      const {unloadAfter = DEFAULT_SETTINGS.unloadAfter} = settings();
      const minutes = unloadAfter < 0 ? 24 * 60 :
        // subtracting the native 5 second timeout as the browser will wait that long anyway
        Math.max(.25, unloadAfter - 5 / 60);
      return new Promise(resolve => setTimeout(resolve, minutes * 60e3));
    },

    reinject: () => new Promise(resolve => {
      chrome.tabs.query({active: true, currentWindow: true}, ([{id, url}]) => {
        maybeProcess({url, tabId: id, frameId: 0})
          .then(resolve);
      });
    }),
  });
  return _endpoints;
}
