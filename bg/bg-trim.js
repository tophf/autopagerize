/*
global arrayOrDummy
global idb
*/

export async function trimUrlCache(oldRules, newRules, {main = true} = {}) {
  oldRules = arrayOrDummy(oldRules);
  newRules = arrayOrDummy(newRules);

  const prefixedKeyRange = IDBKeyRange.bound(
    self.URL_CACHE_PREFIX,
    self.URL_CACHE_PREFIX + '\uFFFF');
  const invalidateAll =
    oldRules.length !== newRules.length ||
    oldRules.some((r, i) => (r || {}).url !== (newRules[i] || {}).url);
  if (invalidateAll)
    return idb.exec(true, 'delete', prefixedKeyRange);

  const isSameRule = ruleIndex => {
    if (ruleIndex < 0) {
      if (main)
        return true;
      ruleIndex = -ruleIndex - 1;
    } else if (!main)
      return true;
    const a = oldRules[ruleIndex];
    const b = newRules[ruleIndex];
    if (!a || !b)
      return;
    for (const k in a)
      if (a[k] !== b[k])
        return;
    for (const k in b)
      if (!a.hasOwnProperty(k))
        return;
    return true;
  };

  const op = (await idb.exec(true)).openCursor(prefixedKeyRange);

  return new Promise(resolve => {
    op.onsuccess = () => {
      const cursor = /** IDBCursorWithValue */ op.result;
      if (!cursor) {
        op.transaction.db.close();
        resolve();
      } else if (arrayOrDummy(cursor.value).every(isSameRule)) {
        cursor.continue();
      } else {
        cursor.delete().onsuccess = () => cursor.continue();
      }
    };
  });
}
