/* eslint-env worker */
/* global idb */
'use strict';

importScripts('storage-idb.js');

self.onmessage = async ({data: [url, urlCacheKey, settings]}) => {
  let cache = await idb.get('cache');
  if (!cache ||
      !cache.rules ||
      !cache.rules.length ||
      !Array.isArray(cache.rules)) {
    cache = {
      rules: await (await fetch('siteinfo.json')).json(),
      expires: 0,
    };
    await idb.exec(true, 'clear');
    await idb.set('cache', cache);
  }
  const toReturn = [];
  const toWrite = [];
  for (const {rules = []} of [settings, cache]) {
    let index = 0;
    for (const r of rules) {
      try {
        if (RegExp(r.url).test(url)) {
          toReturn.push(r);
          toWrite.push(rules === cache.rules ? index : -index - 1);
        }
      } catch (e) {}
      index++;
    }
  }
  if (urlCacheKey)
    await idb.set(urlCacheKey, toWrite);
  self.postMessage(toReturn);
};
