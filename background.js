/*
global CACHE_DURATION
global idbStorage
global chromeStorage
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

chrome.runtime.onStartup.addListener(async () => {
  setTimeout(refreshSiteinfo, 10e3);
  const cache = ensureObject(await idbStorage.cache);
  if (!ensureArray(cache.rules).length) {
    idbStorage.cache = {
      rules: await (await fetch('siteinfo.json')).json(),
      expires: Date.now() - 1,
    };
  }
});

async function maybeLaunch(tab) {
  const settings = ensureObject(await chromeStorage.settings);
  if (isExcluded(tab.url, ensureArray(settings.excludes), EXCLUDES))
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
  const [type] = await executeScript(tabId, {
    code: `
      window.settings = {
        disable: ${settings.disable},
        display_message_bar: ${settings.display_message_bar},
      };
      typeof AutoPager;
    `,
  });
  if (type !== 'function')
    await executeScript(tabId, {file: 'content.js'});
}

function sanitizeRemoteData(data) {
  return (Array.isArray(data) ? data : [])
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

async function refreshSiteinfo({force} = {}) {
  const cache = await idbStorage.cache;

  if (force || !cache || cache.expires < Date.now()) {
    try {
      const json = await (await fetch(DATA_URL, {
        headers: {
          'Cache-Control': 'no-cache',
        }
      })).json();
      const rules = sanitizeRemoteData(json);
      const expires = Date.now() + CACHE_DURATION;
      if (rules.length)
        idbStorage.cache = {rules, expires};
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
         str.replace(/([-()\[\]{}+?.$^|,:#<!\\])/g, '\\$1')
            .replace(/\x08/g, '\\x08')
            .replace(/\*/g, '.*');
}

function executeScript(tabId, options) {
  return new Promise(resolve => {
    chrome.tabs.executeScript(tabId, options, results => {
      ignoreLastError();
      resolve(results || []);
    });
  });
}

function getMatchingRules(...args) {
  return new Promise(resolve => {
    const w = new Worker('worker.js');
    w.onmessage = ({data}) => {
      w.onmessage = null;
      w.terminate();
      resolve(data);
    };
    w.postMessage(args);
  })
}
