'use strict';

// using var to share via `window` or `self` with modules
/* eslint-disable no-var */
var CACHE_DURATION = 24 * 60 * 60 * 1000;
var settings = null;
var cache = new Map();
var cacheKeys = null;
var globalRules = null;
var str2rx = new Map();
/** @type module:storage-idb */
var idb = null;
var utf8encoder = new TextEncoder();
var utf8decoder = new TextDecoder();
var endpoints;
/* eslint-enable no-var */

const processing = new Map();

if (getCacheDate() + CACHE_DURATION < Date.now())
  import('/bg/bg-update.js').then(m =>
    m.updateSiteinfo({force: true}));

if (isGloballyEnabled())
  observeNavigation();

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

function observeNavigation() {
  const filter = {url: [{schemes: ['http', 'https']}]};
  chrome.webNavigation.onCompleted.addListener(maybeProcessMain, filter);
  chrome.webNavigation.onHistoryStateUpdated.addListener(maybeProcess, filter);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(maybeProcess, filter);
}

function onChromeMenu(info) {
  (endpoints || initMessaging()).switchGlobalState(info.checked);
}

function onChromeCommand(cmd) {
  if (cmd === 'onOff') {
    (endpoints || initMessaging()).switchGlobalState(!isGloballyEnabled());
    return;
  }
  if (cmd.startsWith('loadMore')) {
    chrome.tabs.executeScript({
      code: `
        typeof run === 'function' &&
        run({loadMore: ${cmd.slice(-2)}})
      `,
    }, ignoreLastError);
    return;
  }
}

function onRuntimeMessage(msg, sender, sendResponse) {
  if (!endpoints)
    initMessaging();
  const fn = endpoints[msg.action];
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

function initMessaging() {
  endpoints = Object.assign(Object.create(null), {
    launched: (_, {tab: {id}}) => {
      chrome.pageAction.show(id);
      chrome.pageAction.setIcon({
        tabId: id,
        path: {
          16: 'icons/icon16.png',
          32: 'icons/icon32.png',
          48: 'icons/icon48.png',
        },
      });
    },
    writeSettings: async ss => {
      await (await import('/bg/bg-settings.js')).writeSettings(ss);
    },
    updateSiteinfo: async portName => {
      const port = chrome.runtime.connect({name: portName});
      const result = await (await import('/bg/bg-update.js')).updateSiteinfo({
        force: true,
        onprogress: e => port.postMessage(e.loaded),
      });
      port.disconnect();
      return result >= 0 ? result : String(result);
    },
    switchGlobalState: async state => {
      await (await import('/bg/bg-switch.js')).switchGlobalState(state);
    },
  });
  return endpoints;
}

function maybeProcessMain(info) {
  return maybeProcess.call(true, info);
}

async function maybeProcess({tabId, frameId, url}) {
  if (!frameId && processing.get(tabId) !== url) {
    processing.set(tabId, url);
    if (!settings)
      settings = await getSettings();
    if (!isExcluded(url))
      await maybeLaunch(tabId, url, this); // eslint-disable-line no-invalid-this
    processing.delete(tabId);
  }
}

async function maybeLaunch(tabId, url, lastTry) {
  if (!idb)
    idb = await import('/util/storage-idb.js');
  const key = await calcUrlCacheKey(url);
  const packedRules = await idb.exec({store: 'urlCache'}).get(key);
  const rules =
    packedRules && await (await import('/bg/bg-unpack.js')).unpackRules(packedRules) ||
    await (await import('/bg/bg-filter.js')).filterCache(url, key, packedRules);
  if (!globalRules)
    await addGlobalRules();
  rules.push(...globalRules);
  if (rules.length)
    await (await import('/bg/bg-launch.js')).launch(tabId, rules, key, {lastTry});
}

function isExcluded(url) {
  if (url.startsWith('https://mail.google.com/') ||
      url.startsWith('http://b.hatena.ne.jp/') ||
      url.startsWith('https://www.facebook.com/plugins/like.php') ||
      url.startsWith('http://api.tweetmeme.com/button.js'))
    return true;
  for (const entry of arrayOrDummy(settings.excludes)) {
    const isRegexp = entry.startsWith('/') && entry.endsWith('/');
    if (!isRegexp) {
      if (url === entry || url.endsWith('/') && url === entry + '/')
        return true;
      const i = entry.indexOf('*');
      if (i < 0)
        continue;
      if (i === entry.length - 1 && url.startsWith(entry.slice(0, -1)))
        return true;
    }
    let rx = str2rx.get(entry);
    if (rx === false)
      continue;
    if (!rx) {
      try {
        const rxStr = isRegexp
          ? entry.slice(1, -1)
          : '^' +
            entry.replace(/([-()[\]{}+?.$^|\\])/g, '\\$1')
              .replace(/\x08/g, '\\x08')
              .replace(/\*/g, '.*') +
            '$';
        rx = RegExp(rxStr);
        str2rx.set(entry, rx);
      } catch (e) {
        str2rx.set(entry, false);
        continue;
      }
    }
    if (rx.test(url))
      return true;
  }
}

async function addGlobalRules() {
  globalRules = arrayOrDummy(await getLocal('globalRules'));
  if (!globalRules.length)
    await (await import('/bg/bg-global-rules.js')).buildGlobalRules();
}

async function calcUrlCacheKey(url) {
  const bytes = utf8encoder.encode(url);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash).slice(0, 16);
}

function calcRuleKey(rule) {
  const url = utf8encoder.encode(rule.url);
  const key = new Uint8Array(url.length + 4);
  new DataView(key.buffer).setUint32(0, rule.id, true);
  key.set(url, 4);
  return key;
}

function parseRuleKey(rule) {
  const key = rule.url;
  rule.id = new DataView(key.buffer || key).getUint32(0, true);
  rule.url = utf8decoder.decode(key.slice(4));
}
