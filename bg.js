/*
global idb
global chromeSync
global chromeLocal
global LZStringUnsafe
*/
'use strict';

const EXCLUDES = [
  'https://mail.google.com/*',
  'http://b.hatena.ne.jp/*',
  'https://www.facebook.com/plugins/like.php*',
  'http://api.tweetmeme.com/button.js*',
];

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
  if (info.status === 'complete')
    maybeLaunch(tab);
});

chrome.storage.onChanged.addListener(async ({settings}) => {
  if (settings)
    (await import('/bg-trim.js')).trimUrlCache(
      settings.oldValue.rules,
      settings.newValue.rules,
      {main: false});
});

(async () => {
  const date = await chromeLocal.get('siteinfoDate') || 0;
  if (date + self.CACHE_DURATION < Date.now())
    (await import('/bg-update.js')).updateSiteinfo({force: true});
})();

async function maybeLaunch(tab) {
  const settings = await chromeSync.getObject('settings');
  if (!isExcluded(tab.url, settings.excludes, EXCLUDES)) {
    const rules = await getMatchingRules(tab.url, settings);
    if (rules.length)
      (await import('/bg-launch.js')).launch(tab.id, settings, rules);
  }
}

function isExcluded(url, ...sets) {
  for (const set of sets) {
    if (!Array.isArray(set))
      continue;
    for (const entry of set) {
      if (!entry)
        continue;
      let rx;
      if (entry.startsWith('/') && entry.endsWith('/')) {
        rx = entry.slice(1, -1);
      } else {
        rx = wildcard2regexp(entry);
      }
      if (url.match(rx))
        return true;
    }
  }
  return false;
}

function wildcard2regexp(str) {
  return '^' +
         str.replace(/([-()[\]{}+?.$^|\\])/g, '\\$1')
            .replace(/\x08/g, '\\x08')
            .replace(/\*/g, '.*');
}

async function getMatchingRules(url, settings) {
  let urlCacheKey;
  if (url.length < self.MAX_CACHEABLE_URL_LENGTH) {
    urlCacheKey = self.URL_CACHE_PREFIX + LZStringUnsafe.compressToUTF16(url);
    const rules = await idb.get(urlCacheKey);
    if (rules && await resolveUrlRules(rules, settings))
      return rules;
  }
  const {rules, cacheReset} = await runWorker(url, urlCacheKey, settings);
  if (cacheReset)
    chromeLocal.set('siteinfoDate', Date.now());
  return rules;
}

async function resolveUrlRules(rules, settings) {
  const cache = await idb.get('cache');
  const customRules = settings.rules || [];
  for (let i = 0; i < rules.length; i++) {
    let r = rules[i];
    r = rules[i] = r >= 0 ? cache[r] : customRules[-r - 1];
    if (!r)
      return;
  }
  return true;
}

function runWorker(...args) {
  return new Promise(resolve => {
    const w = new Worker('worker.js');
    w.onmessage = ({data}) => {
      w.onmessage = null;
      w.terminate();
      resolve(data);
    };
    w.postMessage(args);
  });
}

function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}
