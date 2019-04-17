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
*/
'use strict';

const EXCLUDES = [
  'https://mail.google.com/*',
  'http://b.hatena.ne.jp/*',
  'https://www.facebook.com/plugins/like.php*',
  'http://api.tweetmeme.com/button.js*',
];

let worker = null;
const workerQueue = new Map();

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

chrome.storage.onChanged.addListener(async ({settings: s}) => {
  if (s) {
    self.settings = s.newValue;
    (await import('/bg/bg-trim.js'))
      .trimUrlCache(s.oldValue.rules, s.newValue.rules, {main: false});
  }
});

(async () => {
  const date = await chromeLocal.get('siteinfoDate') || 0;
  if (date + CACHE_DURATION < Date.now())
    (await import('/bg/bg-update.js')).updateSiteinfo({force: true});
})();

async function maybeLaunch(tab) {
  if (!self.settings)
    self.settings = await chromeSync.getObject('settings');
  if (!isExcluded(tab.url, settings.excludes, EXCLUDES)) {
    const rules = await getMatchingRules(tab.url);
    if (rules.length)
      (await import('/bg/bg-launch.js')).launch(tab.id, rules);
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

async function getMatchingRules(url) {
  let urlCacheKey;
  if (url.length < MAX_CACHEABLE_URL_LENGTH) {
    urlCacheKey = URL_CACHE_PREFIX + LZStringUnsafe.compressToUTF16(url);
    const rules = await idb.get(urlCacheKey);
    if (rules && await resolveUrlRules(rules))
      return rules;
  }
  const {rules, cacheReset} = await runWorker({url, urlCacheKey});
  if (cacheReset)
    chromeLocal.set('siteinfoDate', Date.now());
  return rules;
}

async function resolveUrlRules(rules) {
  if (!self.cache)
    self.cache = await idb.get('cache');
  const customRules = settings.rules || [];
  for (let i = 0; i < rules.length; i++) {
    let r = rules[i];
    r = rules[i] = r >= 0 ? cache[r] : customRules[-r - 1];
    if (!r)
      return;
  }
  return true;
}

function runWorker(args) {
  if (!worker) {
    worker = new Worker('/bg/worker.js');
    worker.onmessage = onWorkerMessage;
  }
  args.id = performance.now();
  args.settings = settings;
  worker.postMessage(args);
  return new Promise(r => workerQueue.set(args.id, r));
}

function onWorkerMessage({data}) {
  const resolve = workerQueue.get(data.id);
  workerQueue.delete(data.id);
  resolve(data);
}

function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}
