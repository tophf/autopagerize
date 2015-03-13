'use strict';

importScripts('storage-idb.js');

self.onmessage = async ({data: [url, settings]}) => {
  const results = [];
  const cache = await idbStorage.cache || {};
  for (const {rules = []} of [settings, cache]) {
    for (const r of rules) {
      try {
        if (r.url && url.match(r.url))
          results.push(r);
      } catch (e) {}
    }
  }
  self.postMessage(results);
};
