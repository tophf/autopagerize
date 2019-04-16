/* eslint-env worker */
/* global idb */
'use strict';

importScripts('/util/storage-idb.js');

self.onmessage = async ({data: [url, urlCacheKey, settings]}) => {
  let cache = await idb.get('cache') || [];
  let cacheReset;
  if (!Array.isArray(cache) || !cache.length) {
    cacheReset = true;
    cache = await (await fetch('siteinfo.json')).json();
    await idb.exec(true, 'clear');
    await idb.set('cache', cache);
  }
  const toReturn = [];
  const toWrite = [];
  for (const rules of [settings.rules, cache]) {
    let index = 0;
    for (const r of rules || []) {
      try {
        if (RegExp(r.url).test(url)) {
          toReturn.push(r);
          toWrite.push(rules === cache ? index : -index - 1);
        }
      } catch (e) {}
      index++;
    }
  }
  if (urlCacheKey)
    await idb.set(urlCacheKey, toWrite);
  self.postMessage({rules: toReturn, cacheReset});
};
