export {
  buildGlobalRules,
};

async function buildGlobalRules() {
  if (!cacheKeys)
    await (await import('/bg/bg-filter.js')).loadCacheKeys();
  const toRead = [];
  globalRules.length = 0;
  for (const key of cacheKeys.values()) {
    if (isGlobalUrl(key.url)) {
      const rule = cache.get(key.id);
      if (!rule)
        toRead.push([globalRules.length, key.id]);
      globalRules.push(rule);
    }
  }
  if (toRead.length)
    await (await import('/bg/bg-unpack.js')).readMissingRules(globalRules, toRead);
  chrome.storage.local.set({globalRules});
}
