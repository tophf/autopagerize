import {offscreen} from './bg-offscreen.js';
import {arrayOrDummy} from '/util/common.js';
import {dbExec} from '/util/storage-idb.js';
import {buildGenericRules, buildSiteinfo} from './bg-filter.js';
import {trimUrlCache} from './bg-trim.js';
import {calcRuleKey, ruleKeyToUrl} from './bg-util.js';
import {cache, cacheKeys, keepAlive} from './bg.js';

const DATA_URL = 'http://wedata.net/databases/AutoPagerize/items_all.json';
const KNOWN_KEYS = [
  'url',
  'nextLink',
  'insertBefore',
  'pageElement',
];

export async function updateSiteinfo(portName) {
  try {
    keepAlive(true);
    const opts = {headers: {'Cache-Control': 'no-cache'}};
    /** @type {Map[]} */
    const [old, fresh] = await Promise.all([
      getCacheIndexedById(),
      (portName
        ? offscreen.xhr(DATA_URL, {...opts, portName, timeout: /*same as fetch*/ 300e3})
        : fetch(DATA_URL, {...opts}).then(r => r.text())
      ).then(sanitize),
    ]);
    keepAlive();
    if (!fresh.size)
      return 0;
    await removeObsoleteRules(old, fresh);
    await trimUrlCache(old, fresh);
    await buildSiteinfo.busy;
    await buildSiteinfo(fresh.values(), rule => !shallowEqual(rule, old.get(rule.id)));
    buildGenericRules();
    return fresh.size;
  } catch (e) {
    return `${e.target?.error || e}`;
  }
}

function sanitize(data) {
  data = arrayOrDummy(JSON.parse(data));
  const map = new Map();
  let len = 0;
  for (let i = 0, v; i < data.length; i++) {
    v = data[i];
    if (v?.data?.url) data[len++] = pickKnownKeys(v.data, v.resource_url);
  }
  data.length = len;
  data.sort((a, b) => a.id - b.id);
  for (const v of data) map.set(v.id, v);
  return map;
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
  const all = await dbExec.getAll();
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
      store = await dbExec.WRITE;
    op = store.delete(calcRuleKey(a));
  }
  if (op) {
    const pr = Promise.withResolvers();
    op.onsuccess = pr.resolve;
    op.onerror = pr.reject;
    await pr.promise;
  }
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
