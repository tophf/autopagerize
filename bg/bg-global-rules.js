export {
  buildGlobalRules,
};

import {
  isGlobalUrl,
} from '/util/common.js';

import {
  cache,
  cacheKeys,
  globalRules,
} from './bg.js';

async function buildGlobalRules() {
  if (!cacheKeys.size)
    await (await import('./bg-filter.js')).loadCacheKeys();
  const toRead = [];
  const rules = [];
  for (const key of cacheKeys.values()) {
    if (isGlobalUrl(key.url)) {
      const rule = cache.get(key.id);
      if (!rule)
        toRead.push([rules.length, key.id]);
      rules.push(rule);
    }
  }
  if (toRead.length)
    await (await import('./bg-unpack.js')).readMissingRules(rules, toRead);
  chrome.storage.local.set({globalRules: rules});
  globalRules(rules);
}
