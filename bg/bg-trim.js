/*
global arrayOrDummy
global idb
*/

export async function trimUrlCache(oldRules, newRules, {main = true} = {}) {
  oldRules = arrayOrDummy(oldRules);
  newRules = arrayOrDummy(newRules);

  if (!self.idb)
    self.idb = await import('/util/storage-idb.js');

  const invalidateAll =
    oldRules.length !== newRules.length ||
    oldRules.some((r, i) => (r || {}).url !== (newRules[i] || {}).url);
  if (invalidateAll)
    return idb.execRW({store: 'urlCache'}).clear();

  const rulesChanged = packedRules => {
    for (let i = 0; i < packedRules.length; i++) {
      let index = packedRules[i];
      if (index < 0) {
        if (main)
          continue;
        index = -index - 1;
      } else if (!main)
        continue;
      const a = oldRules[index];
      const b = newRules[index];
      if (!a || !b)
        return true;
      for (const k in a)
        if (k !== 'index' && a[k] !== b[k])
          return true;
      for (const k in b)
        if (!a.hasOwnProperty(k))
          return true;
    }
  };

  const op = (await idb.execRW({store: 'urlCache'})).openCursor();

  return new Promise((resolve, reject) => {
    op.onsuccess = () => {
      const cursor = /** IDBCursorWithValue */ op.result;
      if (!cursor) {
        resolve();
      } else if (rulesChanged(cursor.value)) {
        cursor.delete().onsuccess = () => cursor.continue();
      } else {
        cursor.continue();
      }
    };
    op.onerror = reject;
  });
}
