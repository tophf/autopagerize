import {
  executeScript,
  ignoreLastError,
  isGloballyEnabled,
} from '/util/common.js';

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

    launched: (_, {tab: {id}}) => {
      chrome.pageAction.show(id);
      chrome.pageAction.setIcon({
        tabId: id,
        path: {
          16: '/icons/16.png',
          32: '/icons/32.png',
          48: '/icons/48.png',
        },
      });
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
  });
  return _endpoints;
}
