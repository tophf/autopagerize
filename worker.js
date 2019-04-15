/* eslint-env worker */
/*
global URL_CACHE_PREFIX
global MAX_CACHEABLE_URL_LENGTH
global idbStorage
global LZStringUnsafe
*/
'use strict';

importScripts('storage-idb.js', 'vendor/lz-string-unsafe.min.js');

self.onmessage = async ({data: [url, settings]}) => {
  let cache = await idbStorage.cache;
  if (!cache ||
      !cache.rules ||
      !cache.rules.length ||
      !Array.isArray(cache.rules)) {
    cache = {
      rules: await (await fetch('siteinfo.json')).json(),
      expires: 0,
    };
    await idbStorage(true, 'clear');
    idbStorage.cache = cache;
  }
  let results, urlCacheKey;
  if (url.length < MAX_CACHEABLE_URL_LENGTH) {
    urlCacheKey = URL_CACHE_PREFIX + LZStringUnsafe.compressToUTF16(url);
    results = await idbStorage[urlCacheKey];
  }
  if (!results) {
    results = [];
    for (const {rules = []} of [settings, cache]) {
      let index = 0;
      for (const r of rules) {
        try {
          if (r.url && url.match(r.url))
            results.push(index);
        } catch (e) {}
        index++;
      }
    }
    if (urlCacheKey) {
      idbStorage[urlCacheKey] = results;
      await new Promise(setTimeout);
    }
  }
  self.postMessage(results.map(r => cache.rules[r]));
};
