/* global idb */
'use strict';

window.CACHE_DURATION = 24 * 60 * 60 * 1000;
window.URL_CACHE_PREFIX = 'cache:';
window.MAX_CACHEABLE_URL_LENGTH = 1000;

window.idb = {
  DB_NAME: 'db',
  STORE_NAME: 'store',
  /** @type IDBDatabase */
  _db: null,
  get(key) {
    return idb.exec(false, 'get', key);
  },
  set(key, value) {
    return idb.exec(true, 'put', value, key);
  },
  exec(readWrite, method, ...params) {
    return new Promise((resolve, reject) => {
      if (idb._db) {
        idb._execRaw(readWrite, method, params, resolve, reject);
      } else {
        const op = indexedDB.open(idb.DB_NAME);
        op.onupgradeneeded = () => op.result.createObjectStore(idb.STORE_NAME);
        op.onsuccess = () => {
          idb._db = op.result;
          idb._execRaw(readWrite, method, params, resolve, reject);
        };
      }
    });
  },
  async _execRaw(readWrite, method, params, resolve, reject) {
    let op = idb._db
      .transaction(idb.STORE_NAME, readWrite ? 'readwrite' : 'readonly')
      .objectStore(idb.STORE_NAME);
    if (method) {
      op = op[method](...params);
      op.onsuccess = () => resolve(op.result);
      op.onerror = reject;
    } else {
      resolve(op);
    }
  },
};
