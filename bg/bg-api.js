import {getActiveTab, ignoreLastError, tabSend} from '/util/common.js';
import {dbExec} from '/util/storage-idb.js';
import {buildGenericRules} from './bg-filter.js';
import {setIcon} from './bg-icon.js';
import {launch} from './bg-launch.js';
import {writeSettings} from './bg-settings.js';
import {switchGlobalState} from './bg-switch.js';
import {updateSiteinfo} from './bg-update.js';
import {isUrlExcluded} from './bg-util.js';
import {g, getGenericRules, onNavigation} from './bg.js';
import {offscreen} from './bg-offscreen.js';

let POPUP;

const api = {
  __proto__: null,
  isUrlExcluded: url => g.cfg instanceof Promise
    ? g.cfg.then(() => isUrlExcluded(url))
    : isUrlExcluded(url),
  /** @this {chrome.runtime.MessageSender} */
  launched() {
    const tabId = this.tab.id;
    if (!POPUP) POPUP = chrome.runtime.getManifest().action.default_popup.split('?')[0];
    chrome.action.setPopup({tabId, popup: POPUP});
    setIcon({tabId});
  },
  reinject: opts => onNavigation({...opts, frameId: 0}, true),
  setIcon,
  switchGlobalState,
  tryGenericRules: async tabId => launch(tabId, await getGenericRules(), {lastTry: 'genericRules'}),
  updateSiteinfo,
  writeSettings,
};

chrome.contextMenus.onClicked.addListener(onChromeMenu);
chrome.commands.onCommand.addListener(onChromeCommand);
chrome.runtime.onMessage.addListener(onRuntimeMessage);


function onChromeMenu(info) {
  switchGlobalState(info.checked);
}

async function onChromeCommand(cmd) {
  if (cmd === 'onOff') {
    await g.cfg;
    return switchGlobalState(!g.cfg.enabled);
  }
  if (cmd.startsWith('loadMore')) {
    return tabSend((await getActiveTab()).id, ['run', {loadMore: +cmd.slice(-2)}]);
  }
}

function onRuntimeMessage(msg, sender, sendResponse) {
  const fn = api[msg.action];
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

chrome.runtime.onInstalled.addListener(async info => {
  if (info.reason !== 'update' && info.reason !== 'install')
    return;

  chrome.alarms.get('update', a => {
    const p = 24 * 60; // 1 day
    if (!a || a.periodInMinutes !== p)
      chrome.alarms.create('update', {periodInMinutes: p});
  });

  chrome.contextMenus.create({
    id: 'onOff',
    type: 'checkbox',
    contexts: ['action'],
    title: chrome.i18n.getMessage('onOff'),
  }, ignoreLastError);

  if (info.previousVersion <= '1.0.6') {
    buildGenericRules();
    chrome.storage.local.clear();
    const keys = ['cacheDate', 'enabled'];
    const {cacheDate, enabled} = await offscreen.localStorageGet(keys);
    const cd = new Date(+cacheDate);
    keys.push('fixes', 'orphanMessageId');
    offscreen.localStorageSet(Object.fromEntries(keys.map(k => [k])));
    dbExec({store: 'data'}).put(+cd ? cd : new Date(), 'cacheDate');
    if (enabled === 'false')
      return;
  }

  switchGlobalState(true);
});
