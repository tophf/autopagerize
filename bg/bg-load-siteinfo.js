export {
  loadBuiltinSiteinfo,
  loadSiteinfo,
};

import {isGenericUrl, setCacheDate} from '/util/common.js';
import * as idb from '/util/storage-idb.js';
import {calcRuleKey} from './bg-util.js';
import {cache, cacheKeys, genericRules} from './bg.js';

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
  const gr = [];
  let /** @type IDBObjectStore */ store, op;
  for (const rule of si) {
    const {id, url} = rule;
    cache.set(id, rule);
    cacheKeys.set(id, rule);
    if (isGenericUrl(url))
      gr.push(rule);
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
  genericRules(gr);
  chrome.storage.local.set({genericRules: gr});
  if (op) {
    return new Promise((resolve, reject) => {
      op.onsuccess = resolve;
      op.onerror = reject;
    });
  }
}
