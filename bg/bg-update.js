export {
  updateSiteinfo,
};

import {
  arrayOrDummy,
} from '/util/common.js';

import {
  calcRuleKey,
  ruleKeyToUrl,
} from './bg-util.js';

import {
  cache,
  cacheKeys,
  globalRules,
} from './bg.js';

import * as idb from '/util/storage-idb.js';

const DATA_URL = 'http://wedata.net/databases/AutoPagerize/items_all.json';
const KNOWN_KEYS = [
  'url',
  'nextLink',
  'insertBefore',
  'pageElement',
];

/**
 * @param {object} [_]
 * @param {boolean} [_.force]
 * @param {function(ProgressEvent)} [_.onprogress]
 */
async function updateSiteinfo({force, onprogress} = {}) {
  if (!force && await idb.exec().count())
    return;
  const bgTrim = await import('./bg-trim.js');
  try {
    const [old, fresh] = await Promise.all([
      getCacheIndexedById(),
      download(onprogress).then(sanitize).then(bgTrim.convertToMap),
    ]);
    if (!fresh.size)
      return 0;
    await removeObsoleteRules(old, fresh);
    await bgTrim.trimUrlCache(old, fresh);
    await (await import('./bg-load-siteinfo.js'))
      .loadSiteinfo(fresh.values(), rule => !shallowEqual(rule, old.get(rule.id)));
    chrome.storage.local.remove('globalRules');
    globalRules(null);
    return fresh.size;
  } catch (e) {
    return (e.target || {}).error || e;
  }
}

function download(onprogress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', DATA_URL);
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    xhr.responseType = 'json';
    xhr.onprogress = onprogress;
    xhr.timeout = 60e3;
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = reject;
    xhr.ontimeout = reject;
    xhr.send();
  });
}

function sanitize(data) {
  return arrayOrDummy(data)
    .map(x => x && x.data && x.data.url && pickKnownKeys(x.data, x.resource_url))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
}

function pickKnownKeys(entry, resourceUrl) {
  for (const key of Object.keys(entry)) {
    if (!KNOWN_KEYS.includes(key)) {
      const newEntry = {};
      for (const k of KNOWN_KEYS) {
        const v = entry[k];
        if (v !== undefined)
          newEntry[k] = v;
      }
      entry = newEntry;
      break;
    }
  }
  entry.id = Number(resourceUrl.slice(resourceUrl.lastIndexOf('/') + 1));
  return entry;
}

async function getCacheIndexedById() {
  if (cache.size && cache.size === cacheKeys.size)
    return cache;
  const all = await idb.exec().getAll();
  const byId = new Map();
  for (const r of all) {
    r.url = ruleKeyToUrl(r.url);
    byId.set(r.id, r);
  }
  return byId;
}

async function removeObsoleteRules(old, fresh) {
  let /** @type IDBObjectStore */ store, op;
  for (const a of old.values()) {
    const b = fresh.get(a.id);
    if (b && b.url === a.url)
      continue;
    if (!store)
      store = await idb.execRW().RAW;
    op = store.delete(calcRuleKey(a));
  }
  if (op)
    await new Promise((resolve, reject) => {
      op.onsuccess = resolve;
      op.onerror = reject;
    });
}

function shallowEqual(a, b) {
  if (!a !== !b)
    return;
  for (const k in a)
    if (a[k] !== b[k])
      return;
  for (const k in b)
    if (!a.hasOwnProperty(k))
      return;
  return true;
}
