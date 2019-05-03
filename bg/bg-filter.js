export {
  filterCache,
  loadCacheKeys,
};

import {
  arrayOrDummy,
  isGlobalUrl,
} from '/util/common.js';

import {
  ruleKeyToUrl,
  str2rx,
} from './bg-util.js';

import {
  cache,
  cacheKeys,
  settings,
} from './bg.js';

import * as idb from '/util/storage-idb.js';

async function filterCache(url, urlCacheKey, packedRules) {
  if (!cacheKeys.size)
    await loadCacheKeys();
  if (!cacheKeys.size)
    await (await import('./bg-load-siteinfo.js')).loadBuiltinSiteinfo();
  if (cacheKeys.values().next().value.rx === null)
    regexpifyCache();
  const customRules = arrayOrDummy(settings().rules);
  if (customRules.length && !customRules[0].hasOwnProperty('rx'))
    regexpifyCustomRules();
  const toUse = [];
  const toWrite = [];
  const toRead = [];
  for (let i = 0, len = customRules.length; i < len; i++) {
    const rule = customRules[i];
    if (rule.rx && rule.rx.test(url)) {
      toUse.push(rule);
      toWrite.push(-i - 1);
    }
  }
  for (const key of cacheKeys.values()) {
    if (!isGlobalUrl(key.url) && key.rx && key.rx.test(url)) {
      const rule = cache.get(key.id);
      if (!rule)
        toRead.push([toUse.length, key.id]);
      toUse.push(rule);
      toWrite.push(key.id);
    }
  }
  if (toRead.length)
    await (await import('./bg-unpack.js')).readMissingRules(toUse, toRead);
  if (urlCacheKey && `${toWrite}` !== `${packedRules}`)
    idb.execRW({store: 'urlCache'}).put(new Int32Array(toWrite), urlCacheKey);
  return toUse;
}

async function loadCacheKeys() {
  const keys = arrayOrDummy(await idb.exec().getAllKeys());
  keys.sort((a, b) => b.length - a.length);
  cacheKeys.clear();
  for (const key of keys) {
    const rule = {
      url: ruleKeyToUrl(key),
      id: new DataView(key.buffer || key).getUint32(0, true),
      rx: null,
    };
    cacheKeys.set(rule.id, rule);
  }
}

function regexpifyCache() {
  for (const key of cacheKeys.values()) {
    let rx;
    try {
      rx = RegExp(key.url);
    } catch (e) {
      rx = false;
    }
    Object.defineProperty(key, 'rx', {value: rx});
  }
}

function regexpifyCustomRules() {
  for (const r of settings().rules) {
    const {url} = r;
    let rx = str2rx.get(url);
    if (rx === false)
      continue;
    if (!rx) {
      try {
        rx = RegExp(url);
      } catch (e) {
        rx = false;
      }
      str2rx.set(url, rx);
    }
    Object.defineProperty(r, 'rx', {value: rx});
  }
}
