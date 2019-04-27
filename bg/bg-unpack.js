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
  return toRead.length
    ? readMissingRules(unpackedRules, toRead)
    : unpackedRules;
}

export async function readMissingRules(unpackedRules, toRead) {
  const index = /** @type IDBIndex */ await idb.exec({index: 'index'}).RAW;
  if (!cacheUrls)
    cacheUrls = [];
  const ucs2 = new TextDecoder();
  let success = true;
  let onDone;
  let op;
  for (let i = 0; i < toRead.length; i++) {
    const [arrayPos, ruleIndex] = toRead[i];
    let url = cacheUrls[ruleIndex];
    if (!url)
      index.getKey(ruleIndex).onsuccess = ({target: {result: key}}) => {
        if (key)
          url = ucs2.decode(key).slice(1);
      };
    op = index.get(ruleIndex);
    // eslint-disable-next-line no-loop-func
    op.onsuccess = ({target: {result: rule}}) => {
      if (success && url && rule) {
        rule.url = url;
        cache.set(ruleIndex, rule);
        unpackedRules[arrayPos] = rule;
      } else {
        success = false;
      }
      if (i === toRead.length - 1)
        onDone(success && unpackedRules);
    };
  }
  return new Promise((resolve, reject) => {
    onDone = resolve;
    op.onerror = reject;
  });
}
