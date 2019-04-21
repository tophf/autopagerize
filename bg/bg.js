/*
global CACHE_DURATION
global idb
global chromeSync
global chromeLocal
global settings
global str2rx
*/
'use strict';

window.CACHE_DURATION = 24 * 60 * 60 * 1000;

window.settings = null;
window.cache = new Map();
window.cacheUrls = null;
window.cacheUrlsRE = [];
window.str2rx = new Map();
/** @type module:storage-idb */
window.idb = null;

(async () => {
  const date = await chromeLocal.get('cacheDate') || 0;
  if (date + CACHE_DURATION < Date.now())
    (await import('/bg/bg-update.js')).updateSiteinfo({force: true});
})();

const processing = new Set();
const webNavigationFilter = {url: [{schemes: ['http', 'https']}]};
chrome.webNavigation.onCompleted.addListener(maybeProcess, webNavigationFilter);
chrome.webNavigation.onHistoryStateUpdated.addListener(maybeProcess, webNavigationFilter);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(maybeProcess, webNavigationFilter);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {

    case 'launched':
      chrome.pageAction.show(sender.tab.id);
      chrome.pageAction.setIcon({
        tabId: sender.tab.id,
        path: {
          16: 'icons/icon16.png',
          32: 'icons/icon32.png',
          48: 'icons/icon48.png',
        },
      });
      break;

    case 'writeSettings':
      import('/bg/bg-settings.js').then(m => m.writeSettings(msg.settings));
      sendResponse();
      break;
  }
});

async function maybeProcess({tabId, frameId, url}) {
  if (!frameId && !processing.has(tabId)) {
    processing.add(tabId);
    if (!settings)
      self.settings = await chromeSync.getObject('settings');
    if (!isExcluded(url))
      await maybeLaunch(tabId, url);
    processing.delete(tabId);
  }
}

async function maybeLaunch(tabId, url) {
  if (!self.idb)
    self.idb = await import('/util/storage-idb.js');
  const key = await calcUrlCacheKey(url);
  const packedRules = await idb.exec({store: 'urlCache'}).get(key);
  if (packedRules === false)
    return;
  const rules =
    packedRules && await (await import('/bg/bg-unpack.js')).unpackRules(packedRules) ||
    await (await import('/bg/bg-filter.js')).filterCache(url, key, packedRules);
  if (rules.length)
    (await import('/bg/bg-launch.js')).launch(tabId, rules, key);
}

function isExcluded(url) {
  if (url.startsWith('https://mail.google.com/') ||
      url.startsWith('http://b.hatena.ne.jp/') ||
      url.startsWith('https://www.facebook.com/plugins/like.php') ||
      url.startsWith('http://api.tweetmeme.com/button.js'))
    return true;
  for (const entry of arrayOrDummy(settings.excludes)) {
    let rx = str2rx.get(entry);
    if (rx === false)
      continue;
    if (!rx) {
      try {
        const rxStr = entry.startsWith('/') && entry.endsWith('/')
          ? entry.slice(1, -1)
          : '^' +
            entry.replace(/([-()[\]{}+?.$^|\\])/g, '\\$1')
              .replace(/\x08/g, '\\x08')
              .replace(/\*/g, '.*');
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

async function calcUrlCacheKey(url) {
  const bytes = new TextEncoder().encode(url);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash).slice(0, 16);
}

function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}

function ignoreLastError() {
  return chrome.runtime.lastError;
}
