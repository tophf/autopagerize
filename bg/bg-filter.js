export {
  filterCache,
  loadCacheKeys,
};

async function filterCache(url, urlCacheKey, packedRules) {
  if (!cacheKeys)
    await loadCacheKeys();
  if (!cacheKeys.size)
    await (await import('/bg/bg-load-siteinfo.js')).loadBuiltinSiteinfo();
  if (!cacheKeys.values().next().value.hasOwnProperty('rx'))
    regexpifyCache();
  const customRules = arrayOrDummy(settings.rules);
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
    await (await import('/bg/bg-unpack.js')).readMissingRules(toUse, toRead);
  if (urlCacheKey && `${toWrite}` !== `${packedRules}`)
    idb.execRW({store: 'urlCache'}).put(new Int32Array(toWrite), urlCacheKey);
  return toUse;
}

async function loadCacheKeys() {
  const keys = arrayOrDummy(await idb.exec().getAllKeys());
  keys.sort((a, b) => b.url.length - a.url.length);
  cacheKeys = new Map();
  for (const key of keys) {
    const rule = {
      url: key,
      id: 0,
      rx: null,
    };
    parseRuleKey(rule);
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
  for (const r of settings.rules) {
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
