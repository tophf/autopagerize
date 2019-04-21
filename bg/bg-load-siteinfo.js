/*
global idb
global chromeLocal
global cache
global cacheUrls
global cacheUrlsRE
*/

export async function loadBuiltinSiteinfo() {
  const siteinfo = await (await fetch('/siteinfo.json')).json();
  await idb.execRW().clear();
  await idb.execRW({store: 'urlCache'}).clear();
  cache.clear();
  cacheUrls.length = 0;
  cacheUrlsRE.length = 0;
  const utf8 = new TextEncoder();
  const store = /** @type IDBObjectStore */ await idb.execRW().RAW;
  await new Promise((resolve, reject) => {
    let op;
    for (let i = 0; i < siteinfo.length; i++) {
      const rule = siteinfo[i];
      cacheUrls.push(rule.url);
      cache.set(i, rule);
      const {createdAt, ...toWrite} = rule;
      toWrite.url = utf8.encode(String.fromCharCode(createdAt + 32) + rule.url);
      toWrite.index = i;
      op = store.put(toWrite);
    }
    op.onsuccess = resolve;
    op.onerror = reject;
  });
  await chromeLocal.set({cacheDate: Date.now()});
}
