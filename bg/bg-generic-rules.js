export {
  buildGenericRules,
};

import {isGenericUrl} from '/util/common.js';
import {cache, cacheKeys, genericRules} from './bg.js';

async function buildGenericRules() {
  if (!cacheKeys.size)
    await (await import('./bg-filter.js')).loadCacheKeys();
  const toRead = [];
  const rules = [];
  for (const key of cacheKeys.values()) {
    if (isGenericUrl(key.url)) {
      const rule = cache.get(key.id);
      if (!rule)
        toRead.push([rules.length, key.id]);
      rules.push(rule);
    }
  }
  if (toRead.length)
    await (await import('./bg-unpack.js')).readMissingRules(rules, toRead);
  chrome.storage.local.set({genericRules: rules});
  return genericRules(rules);
}
