/*
global arrayOrDummy
global idb
global cache
global cacheUrls
global settings
*/

export async function unpackRules(rules) {
  const customRules = arrayOrDummy(settings.rules);
  const unpackedRules = [];
  const toRead = [];
  for (let i = 0; i < rules.length; i++) {
    const index = rules[i];
    let r;
    if (index >= 0) {
      r = cache.get(index) || true;
      if (r === true)
        toRead.push([i, index]);
    } else {
      r = customRules[-index - 1];
    }
    unpackedRules.push(r);
    if (!r)
      return;
  }
  if (toRead.length)
    await readMissingRules(unpackedRules, toRead);
  return unpackedRules;
}

export async function readMissingRules(unpackedRules, toRead) {
  const index = /** @type IDBIndex */ await idb.exec({index: 'index'}).RAW;
  await new Promise((resolve, reject) => {
    const ucs2 = new TextDecoder();
    let op;
    for (let i = 0; i < toRead.length; i++) {
      const [arrayPos, ruleIndex] = toRead[i];
      op = index.get(ruleIndex);
      op.onsuccess = e => {
        const rule = e.target.result;
        const key = ucs2.decode(rule.url);
        rule.url = key.slice(1);
        rule.createdAt = key.charCodeAt(0) - 32;
        cache.set(ruleIndex, rule);
        unpackedRules[arrayPos] = rule;
        if (i === toRead.length - 1)
          resolve();
      };
    }
    op.onerror = reject;
  });
}
