'use strict';

const CACHE_DURATION = 24 * 60 * 60 * 1000;
const URL_CACHE_PREFIX = 'cache:';
const MAX_CACHEABLE_URL_LENGTH = 1000;

const idb = {
  DB: 'db',
  STORE: 'store',
  get(key) {
    return idb.exec(false, 'get', key);
  },
  set(key, value) {
    return idb.exec(true, 'put', value, key);
  },
  put(value, key) {
    return idb.exec(true, 'put', value, key);
  },
  exec(readWrite, method, ...params) {
    return new Promise((resolve, reject) => {
      let op = indexedDB.open(idb.DB);
      op.onupgradeneeded = idb.onupgradeneeded;
      op.onsuccess = () => {
        op = op.result
          .transaction(idb.STORE, readWrite ? 'readwrite' : 'readonly')
          .objectStore(idb.STORE);
        if (method) {
          op = op[method](...params);
          op.onsuccess = () => resolve(op.result);
          op.onerror = reject;
        } else {
          resolve(op);
        }
      };
    });
  },
  onupgradeneeded(e) {
    e.target.result.createObjectStore(idb.STORE);
  },
};
