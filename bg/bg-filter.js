/*
global idb
global chromeLocal
global settings
global str2rx
global cache
global cacheRegexpified
*/

export async function filterCache(url, urlCacheKey) {
  if (!cache)
    self.cache = await idb.get('cache') || [];
  if (!Array.isArray(cache) || !cache.length)
    self.cache = await loadBuiltinSiteinfo();
  if (!cacheRegexpified) {
    self.cacheRegexpified = true;
    regexpify(cache);
  }

  const toReturn = [];
  const toWrite = [];
  for (const rules of [cache, regexpify(settings.rules, str2rx)]) {
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

  return toReturn;
}

function regexpify(rules, str2rx) {
  if (!Array.isArray(rules))
    return [];
  for (const r of rules) {
    const {url} = r;
    let rx;
    if (str2rx)
      rx = str2rx.get(url);
    if (rx === false)
      continue;
    if (!rx) {
      try {
        rx = RegExp(url);
      } catch (e) {
        rx = false;
      }
      if (str2rx)
        str2rx.set(url, rx);
    }
    Object.defineProperty(r, 'rx', {value: rx});
  }
  return rules;
}

async function loadBuiltinSiteinfo() {
  const cache = await (await fetch('/siteinfo.json')).json();
  await new Promise(r => chrome.storage.local.clear(r));
  await chromeLocal.set({cache, cacheDate: Date.now()});
  return cache;
}
