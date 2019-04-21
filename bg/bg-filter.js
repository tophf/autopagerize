/*
global idb
global chromeLocal
global settings
global str2rx
global cache
global cacheUrls
global cacheUrlsRE
global arrayOrDummy
*/

export async function filterCache(url, urlCacheKey, packedRules) {
  if (!cacheUrls)
    await loadCacheUrls();
  if (!cacheUrls.length)
    await (await import('/bg/bg-load-siteinfo.js')).loadBuiltinSiteinfo();
  if (!cacheUrlsRE.length)
    regexpifyCache();
  const customRules = arrayOrDummy(settings.rules);
  if (customRules.length && !customRules[0].hasOwnProperty('rx'))
    regexpifyCustomRules();
  const toUse = [];
  const toWrite = [];
  const toRead = [];
  for (const rules of [customRules, cacheUrlsRE]) {
    const inMainRules = rules === cacheUrlsRE;
    for (let i = 0; i < rules.length; i++) {
      let r = rules[i];
      const rx = r.rx || r;
      if (!rx || !rx.test(url))
        continue;
      if (inMainRules) {
        r = cache.get(i);
        if (!r)
          toRead.push([toUse.length, i]);
      }
      toUse.push(r);
      toWrite.push(inMainRules ? i : -i - 1);
    }
  }
  if (toRead.length)
    await (await import('/bg/bg-unpack.js')).readMissingRules(toUse, toRead);
  if (urlCacheKey && `${toWrite}` !== `${packedRules}`)
    idb.execRW({store: 'urlCache'}).put(new Int16Array(toWrite), urlCacheKey);
  return toUse;
}

export async function loadCacheUrls() {
  const ucs2 = new TextDecoder();
  // N.B. the same sequence (createdAt then length) must be used everywhere
  self.cacheUrls = (await idb.exec().getAllKeys() || [])
    .map(k => ucs2.decode(k).slice(1))
    .sort((a, b) => b.length - a.length);
}

function regexpifyCache() {
  self.cacheUrlsRE = Array(cacheUrls.length);
  for (let i = 0, rx; i < cacheUrls.length; i++) {
    try {
      rx = RegExp(cacheUrls[i]);
    } catch (e) {
      rx = false;
    }
    cacheUrlsRE[i] = rx;
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
