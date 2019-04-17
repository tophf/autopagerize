/* eslint-env worker */
/* global idb */
'use strict';

importScripts('/util/storage-idb.js');

let cache;
let cacheRegexpified;
const rxCustom = new Map();

self.onmessage = async ({data: {id, url, urlCacheKey, settings, cacheUpdated}}) => {

  if (cacheUpdated) {
    cache = cacheRegexpified = null;
    self.postMessage({id});
    return;
  }

  if (!cache)
    cache = await idb.get('cache') || [];
  const cacheReset = !Array.isArray(cache) || !cache.length;
  if (cacheReset)
    await loadBuiltinSiteinfo();
  if (!cacheRegexpified)
    processCache();

  const customRules = processCustomRules(settings);

  const toReturn = [];
  const toWrite = [];
  for (const rules of [customRules, cache]) {
    const inMainRules = rules === cache;
    for (let i = 0; i < rules.length; i++) {
      const rx = rules[i].rx;
      if (rx && rx.test(url)) {
        toReturn.push(rules[i]);
        toWrite.push(inMainRules ? i : -i - 1);
      }
    }
  }

  if (urlCacheKey)
    idb.set(urlCacheKey, toWrite);

  self.postMessage({id, rules: toReturn, cacheReset});
};

function processCache() {
  for (const r of cache) {
    let rx;
    try {
      rx = RegExp(r.url);
    } catch (e) {}
    Object.defineProperty(r, 'rx', {value: rx});
  }
  cacheRegexpified = true;
}

function processCustomRules(settings) {
  const rules = settings.rules;
  if (!Array.isArray(rules))
    return [];
  for (const r of rules) {
    const {url} = r;
    let rx = rxCustom.get(url);
    if (!rx) {
      try {
        rx = RegExp(url);
      } catch (e) {}
      rxCustom.set(url, rx);
    }
    Object.defineProperty(r, 'rx', {value: rx});
  }
  return rules;
}

async function loadBuiltinSiteinfo() {
  cache = await (await fetch('siteinfo.json')).json();
  await idb.exec(true, 'clear');
  await idb.set('cache', cache);
}
