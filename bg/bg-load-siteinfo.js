export {
  loadBuiltinSiteinfo,
  loadSiteinfo,
};

function loadBuiltinSiteinfo() {
  return Promise.all([
    fetch('/siteinfo.json').then(r => r.json()),
    idb.execRW().clear(),
    idb.execRW({store: 'urlCache'}).clear(),
  ]).then(([si]) => loadSiteinfo(si));
}

async function loadSiteinfo(si, fnCanWrite) {
  cache.clear();
  cacheKeys.clear();
  globalRules = [];
  let /** @type IDBObjectStore */ store, op;
  for (const rule of si) {
    const {id, url} = rule;
    cache.set(id, rule);
    cacheKeys.set(id, rule);
    if (isGlobalUrl(url))
      globalRules.push(rule);
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
  chrome.storage.local.set({globalRules});
  if (op) {
    return new Promise((resolve, reject) => {
      op.onsuccess = resolve;
      op.onerror = reject;
    });
  }
}
