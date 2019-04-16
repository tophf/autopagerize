/*
global CACHE_DURATION
global URL_CACHE_PREFIX
global MAX_CACHEABLE_URL_LENGTH
global idb
global chromeSync
global LZStringUnsafe
global ignoreLastError
global ensureArray ensureObject
*/
'use strict';

const DATA_URL = 'http://wedata.net/databases/AutoPagerize/items_all.json';
const KNOWN_KEYS = [
  'url',
  'nextLink',
  'insertBefore',
  'pageElement',
];
const EXCLUDES = [
  'https://mail.google.com/*',
  'http://b.hatena.ne.jp/*',
  'https://www.facebook.com/plugins/like.php*',
  'http://api.tweetmeme.com/button.js*',
];
const ACTIONS = Object.assign(Object.create(null), {
  launched(msg, sender) {
    chrome.pageAction.show(sender.tab.id);
    chrome.pageAction.setIcon({
      tabId: sender.tab.id,
      path: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
      },
    });
  },
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'complete')
    maybeLaunch(tab);
});

chrome.runtime.onMessage.addListener(function (msg) {
  const action = ACTIONS[msg];
  if (typeof action === 'function')
    return action.apply(null, arguments);
});

chrome.runtime.onStartup.addListener(() => {
  setTimeout(refreshSiteinfo, 10e3);
});

async function maybeLaunch(tab) {
  const settings = ensureObject(await chromeSync.get('settings'));
  if (isExcluded(tab.url, settings.excludes, EXCLUDES))
    return;
  const rules = await getMatchingRules(tab.url, settings);
  if (rules.length) {
    await initContentScript(tab.id, settings);
    chrome.tabs.sendMessage(
      tab.id,
      {name: 'navigation', data: rules},
      {frameId: 0},
      ignoreLastError);
  }
}

async function initContentScript(tabId, settings) {
  const [loaded] = await executeScript(tabId, {
    code: `
      window.settings = {
        disable: ${settings.disable},
        display_message_bar: ${settings.display_message_bar},
      };
      window.loaded;
    `,
  });
  if (loaded !== true)
    await executeScript(tabId, {file: 'content.js'});
}

function sanitizeRemoteData(data) {
  return ensureArray(data)
    .map(x => x && x.data && x.data.url && pickKnownKeys(x.data))
    .filter(Boolean)
    .sort((a, b) => b.url.length - a.url.length);
}

function pickKnownKeys(entry) {
  for (const k in entry) {
    if (Object.hasOwnProperty.call(entry, k) &&
        !KNOWN_KEYS.includes(k)) {
      const newItem = {};
      for (const kk of KNOWN_KEYS) {
        const v = entry[kk];
        if (v !== undefined)
          newItem[kk] = v;
      }
      return newItem;
    }
  }
  return entry;
}

/**
 * @param {object} _
 * @param {boolean} _.force
 * @param {function(ProgressEvent)} _.onprogress
 */
async function refreshSiteinfo({force, onprogress} = {}) {
  const cache = await idb.get('cache');

  if (force || !cache || cache.expires < Date.now()) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', DATA_URL);
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.responseType = 'json';
      xhr.onprogress = onprogress;
      xhr.timeout = 20e3;
      const json = await new Promise((resolve, reject) => {
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = reject;
        xhr.ontimeout = reject;
        xhr.send();
      });
      const rules = sanitizeRemoteData(json);
      const expires = Date.now() + CACHE_DURATION;
      if (rules.length) {
        await trimUrlCache(cache && cache.rules, rules);
        idb.set('cache', {rules, expires});
      }
      return rules.length;
    } catch (e) {
      return e;
    }
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

function executeScript(tabId, options) {
  return new Promise(resolve => {
    chrome.tabs.executeScript(tabId, options, results => {
      ignoreLastError();
      resolve(ensureArray(results));
    });
  });
}

async function getMatchingRules(url, settings) {
  let urlCacheKey;
  if (url.length < MAX_CACHEABLE_URL_LENGTH) {
    urlCacheKey = URL_CACHE_PREFIX + LZStringUnsafe.compressToUTF16(url);
    const urlRules = await idb.get(urlCacheKey);
    if (urlRules) {
      const cache = await idb.get('cache');
      return urlRules.map(r => cache.rules[r]);
    }
  }
  return runWorker(url, urlCacheKey, settings);
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

function trimUrlCache(oldRules, newRules) {
  if (!Array.isArray(oldRules) || !oldRules.length)
    return idb.exec(true, 'clear');
  const isSameRule = ruleIndex => {
    const a = oldRules[ruleIndex];
    const b = newRules[ruleIndex];
    if (!a || !b)
      return;
    for (const k in a)
      if (a[k] !== b[k])
        return;
    for (const k in b)
      if (!a.hasOwnProperty(k))
        return;
    return true;
  };
  return new Promise(async resolve => {
    const ALL_PREFIX_KEYS = IDBKeyRange.bound(URL_CACHE_PREFIX, URL_CACHE_PREFIX + '\uFFFF');
    const op = (await idb.exec(true)).openCursor(ALL_PREFIX_KEYS);
    op.onsuccess = () => {
      const cursor = /** IDBCursorWithValue */ op.result;
      if (!cursor) {
        resolve();
      } else if (ensureArray(cursor.value).every(isSameRule)) {
        cursor.continue();
      } else {
        cursor.delete().onsuccess = () => cursor.continue();
      }
    };
  });
}
