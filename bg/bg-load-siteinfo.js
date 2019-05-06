export {
  loadBuiltinSiteinfo,
  loadSiteinfo,
};

import {isGlobalUrl, setCacheDate} from '/util/common.js';
import * as idb from '/util/storage-idb.js';
import {calcRuleKey} from './bg-util.js';
import {cache, cacheKeys, globalRules} from './bg.js';

async function loadBuiltinSiteinfo() {
  const [si] = await Promise.all([
    (await fetch('/siteinfo.json')).json(),
    idb.execRW().clear(),
    idb.execRW({store: 'urlCache'}).clear(),
  ]);
  return loadSiteinfo(si);
}

async function loadSiteinfo(si, fnCanWrite) {
  cache.clear();
  cacheKeys.clear();
  const globals = [];
  let /** @type IDBObjectStore */ store, op;
  for (const rule of si) {
    const {id, url} = rule;
    cache.set(id, rule);
    cacheKeys.set(id, rule);
    if (isGlobalUrl(url))
      globals.push(rule);
    if (!fnCanWrite || fnCanWrite(rule)) {
      if (!store)
        store = await idb.execRW().RAW;
      op = store.put({
        ...rule,
        url: calcRuleKey(rule),
      });
      op.onerror = console.error;
    }
  }
  setCacheDate();
  globalRules(globals);
  chrome.storage.local.set({globalRules: globals});
  if (op) {
    return new Promise((resolve, reject) => {
      op.onsuccess = resolve;
      op.onerror = reject;
    });
  }
}
