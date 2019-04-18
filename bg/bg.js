/*
global CACHE_DURATION
global MAX_CACHEABLE_URL_LENGTH
global URL_CACHE_PREFIX
global idb
global chromeSync
global chromeLocal
global LZStringUnsafe
global settings
global cache
global str2rx
*/
'use strict';

const EXCLUDES = [
  'https://mail.google.com/*',
  'http://b.hatena.ne.jp/*',
  'https://www.facebook.com/plugins/like.php*',
  'http://api.tweetmeme.com/button.js*',
];

window.str2rx = new Map();
window.settings = {};
window.cache = null;
window.cacheRegexpified = null;

(async () => {
  const date = await chromeLocal.get('cacheDate') || 0;
  if (date + CACHE_DURATION < Date.now())
    (await import('/bg/bg-update.js')).updateSiteinfo({force: true});
})();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg === 'launched') {
    chrome.pageAction.show(sender.tab.id);
    chrome.pageAction.setIcon({
      tabId: sender.tab.id,
      path: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
      },
    });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'complete' &&
      (info.url || tab.url).startsWith('http'))
    maybeLaunch(tab);
});

chrome.storage.onChanged.addListener(async ({settings: s}) => {
  if (s) {
    self.settings = s.newValue;
    (await import('/bg/bg-trim.js'))
      .trimUrlCache(s.oldValue.rules, s.newValue.rules, {main: false});
  }
});

async function maybeLaunch(tab) {
  if (!settings)
    self.settings = await chromeSync.getObject('settings');
  if (!isExcluded(tab.url)) {
    const rules = await getMatchingRules(tab.url);
    if (rules.length)
      (await import('/bg/bg-launch.js')).launch(tab.id, rules);
  }
}

function isExcluded(url) {
  for (const set of [settings.excludes, EXCLUDES]) {
    if (!Array.isArray(set))
      continue;
    for (const entry of set) {
      if (!entry)
        continue;
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
        } catch (e) {
          str2rx.set(entry, false);
          continue;
        }
        str2rx.set(entry, rx);
      }
      if (rx.test(url))
        return true;
    }
  }
}

async function getMatchingRules(url) {
  let key;
  if (url.length < MAX_CACHEABLE_URL_LENGTH) {
    key = URL_CACHE_PREFIX + LZStringUnsafe.compressToUTF16(url);
    const rules = await idb.get(key);
    if (rules && await dereference(rules))
      return rules;
  }
  return (await import('/bg/bg-filter.js')).filterCache(url, key);
}

async function dereference(rules) {
  if (!cache)
    self.cache = await idb.get('cache');
  const customRules = arrayOrDummy(settings.rules);
  for (let i = 0; i < rules.length; i++) {
    let r = rules[i];
    r = rules[i] = r >= 0 ? cache[r] : customRules[-r - 1];
    if (!r)
      return;
  }
  return true;
}

function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}
