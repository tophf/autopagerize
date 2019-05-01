export {
  readMissingRules,
  unpackRules,
};

// (!) needs `settings` to be already loaded
async function unpackRules(packedRules) {
  const customRules = arrayOrDummy(settings.rules);
  const unpackedRules = [];
  const toRead = [];
  for (const id of packedRules) {
    let r;
    if (id < 0) {
      r = customRules[-id - 1];
      if (!r)
        return;
    } else {
      r = cache.get(id);
      !r && toRead.push([unpackedRules.length, id]);
    }
    unpackedRules.push(r);
  }
  return toRead.length
    ? readMissingRules(unpackedRules, toRead)
    : unpackedRules;
}

async function readMissingRules(rules, toRead) {
  if (!cacheKeys)
    cacheKeys = new Map();
  const index = /** @type IDBIndex */ await idb.exec({index: 'id'}).RAW;
  index.__rules = rules;
  let op;
  for (const [arrayPos, id] of toRead) {
    op = index.get(id);
    op.__arrayPos = arrayPos;
    op.onsuccess = readRule;
    op.onerror = console.error;
  }
  return new Promise(resolve => {
    op.__resolve = resolve;
    op.onerror = () => resolve(false);
  });
}

function readRule(e) {
  const op = /** @type IDBRequest */ e.target;
  const r = op.result;
  if (!r) {
    op.transaction.abort();
    return;
  }
  cache.set(r.id, r);
  cacheKeys.set(r.id, r);
  op.source.__rules[op.__arrayPos] = r;
  if (op.__resolve)
    op.__resolve(op.source.__rules);
}
