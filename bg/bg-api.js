export {
  endpoints,
};

import {DEFAULTS, execScript, ignoreLastError, isAppEnabled} from '/util/common.js';
import {genericRules, lastAliveTime, loadGenericRules, onNavigation, settings} from './bg.js';

let _endpoints;

chrome.contextMenus.create({
  id: 'onOff',
  type: 'checkbox',
  contexts: ['page_action', 'browser_action'],
  title: chrome.i18n.getMessage('onOff'),
  checked: isAppEnabled(),
}, ignoreLastError);

chrome.contextMenus.onClicked.addListener(onChromeMenu);
chrome.commands.onCommand.addListener(onChromeCommand);
chrome.runtime.onMessage.addListener(onRuntimeMessage);
chrome.runtime.onInstalled.addListener(onInstalled);

function onChromeMenu(info) {
  endpoints().switchGlobalState(info.checked);
}

function onChromeCommand(cmd) {
  if (cmd === 'onOff') {
    endpoints().switchGlobalState(!isAppEnabled());
    return;
  }
  if (cmd.startsWith('loadMore')) {
    execScript(
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
  const result = fn.apply(sender, msg.data);
  if (result && typeof result.then === 'function') {
    result.then(sendResponse);
    return true;
  }
  if (result !== undefined)
    sendResponse(result);
}

function onInstalled(info) {
  if (info.reason === 'chrome_update')
    return;
  chrome.runtime.getPackageDirectoryEntry(root => {
    root.getDirectory('content', {create: false}, dir => {
      dir.createReader().readEntries(async entries => {
        const fixes = [];
        const jobs = entries.map(async e => {
          if (e.isFile && e.name.startsWith('fix-')) {
            const file = `/${dir.name}/${e.name}`;
            const text = await new Promise(cb => e.file(f => cb(f.text())));
            const rx = /\/\/\s*TEST-(\w+):\s*(.+)/g;
            const filters = [];
            for (let m; (m = rx.exec(text));) filters.push(m.slice(1));
            fixes.push({file, filters});
          }
        });
        await Promise.all(jobs);
        localStorage.fixes = JSON.stringify(fixes);
      });
    });
  });
  if (info.reason === 'update') {
    chrome.storage.sync.get('settings', ({settings}) => {
      if (settings !== undefined) {
        chrome.storage.sync.remove('settings');
        if (settings) {
          const toWrite = {};
          for (const k in DEFAULTS)
            toWrite[k] = settings[k];
          import('./bg-settings.js').then(async m => {
            await m.packSettings(toWrite);
            chrome.storage.sync.set(toWrite);
          });
        }
      }
    });
  }
}

function initEndpoints() {
  /** @typedef EndPoints */
  const EndPoints = {

    isUrlExcluded: async (url, list) =>
      (await import('/bg/bg-util.js')).isUrlExcluded(url, list),

    keepAlive: () => new Promise(keepAlive),

    /** @this chrome.runtime.MessageSender */
    launched() {
      const tabId = this.tab.id;
      chrome.browserAction.setPopup({tabId, popup: '/ui/popup.html'});
      import('./bg-icon.js').then(m => m.setIcon({tabId}));
    },

    reinject: () => new Promise(resolve => {
      chrome.tabs.query({active: true, currentWindow: true}, ([{id, url}]) => {
        onNavigation({url, tabId: id, frameId: 0})
          .then(resolve);
      });
    }),

    setIcon: async cfg => {
      await (await import('./bg-icon.js')).setIcon(cfg);
    },

    switchGlobalState: async state => {
      await (await import('./bg-switch.js')).switchGlobalState(state);
    },

    tryGenericRules: async tab =>
      (await import('./bg-launch.js')).launch({
        ...tab,
        rules: genericRules() || await loadGenericRules(),
        lastTry: 'genericRules',
      }),

    updateSiteinfo: async portName => {
      const port = chrome.runtime.connect({name: portName});
      const result = await (await import('./bg-update.js')).updateSiteinfo({
        force: true,
        onprogress: e => port.postMessage(e.loaded),
      });
      port.disconnect();
      return result >= 0 ? result : String(result);
    },

    writeSettings: async ss => {
      await (await import('./bg-settings.js')).writeSettings(ss);
    },
  };
  Object.setPrototypeOf(EndPoints, null);
  return (_endpoints = EndPoints);
}

/** @return EndPoints */
function endpoints() {
  return _endpoints || initEndpoints();
}

function keepAlive(resolve) {
  const {unloadAfter = DEFAULTS.unloadAfter} = settings();
  const minutes = unloadAfter < 0 ? 24 * 60 :
    // subtracting the native 5 second timeout as the browser will wait that long anyway
    Math.max(.25, unloadAfter - 5 / 60);
  const msToSnooze = lastAliveTime + minutes * 60e3 - Date.now();
  if (msToSnooze > 0)
    setTimeout(keepAlive, msToSnooze, resolve);
  else
    resolve();
}
