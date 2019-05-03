export {
  convertToMap,
  trimUrlCache,
};

import {
  arrayOrDummy,
} from '/util/common.js';

import * as idb from '/util/storage-idb.js';

let state;

async function trimUrlCache(oldRules, newRules, {main = true} = {}) {
  if (state)
    return;
  state = {
    main,
    old: convertToMap(oldRules),
    new: convertToMap(newRules),
  };
  const store = idb.execRW({store: 'urlCache'});
  if (someUrlChanged()) {
    await store.clear();
  } else {
    const op = (await store.RAW).openCursor();
    await new Promise((resolve, reject) => {
      op.onsuccess = processCursor;
      op.onerror = reject;
      op.__resolve = resolve;
    });
  }
  state = null;
}

function convertToMap(obj) {
  return obj instanceof Map ? obj : new Map(arrayOrDummy(obj).map(x => [x.id, x]));
}

function someUrlChanged() {
  const newRules = state.new;
  if (state.old.size !== newRules.size)
    return true;
  for (const r of state.old.values())
    if (r.url !== (newRules.get(r.id) || {}).url)
      return true;
}

function someRuleChanged(packedRules) {
  for (let id of packedRules) {
    if (id < 0) {
      if (state.main)
        continue;
      id = -id - 1;
    } else if (!state.main)
      continue;
    const a = state.old.get(id);
    const b = state.new.get(id);
    if (!a || !b)
      return true;
    for (const k in a)
      if (a[k] !== b[k])
        return true;
    for (const k in b)
      if (!a.hasOwnProperty(k))
        return true;
  }
}

function processCursor({target: op}) {
  const cursor = /** IDBCursorWithValue */ op.result;
  if (cursor) {
    if (someRuleChanged(cursor.value))
      cursor.delete();
    cursor.continue();
  } else {
    op.__resolve();
  }
}
