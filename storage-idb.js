'use strict';

const CACHE_DURATION = 24 * 60 * 60 * 1000;
const URL_CACHE_PREFIX = 'cache:';
const MAX_CACHEABLE_URL_LENGTH = 1000;

const idbStorage = new Proxy(Object.assign(() => {}, {
  DB: 'db',
  STORE: 'store',
  exec(readWrite, method, ...params) {
    return new Promise((resolve, reject) => {
      let op = indexedDB.open(this.DB);
      op.onupgradeneeded = () => op.result.createObjectStore(this.STORE);
      op.onsuccess = () => {
        const mode = readWrite ? 'readwrite' : 'readonly';
        op = op.result
          .transaction(this.STORE, mode)
          .objectStore(this.STORE);
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
}), {
  get(src, key) {
    return src.exec(false, 'get', key);
  },
  set(src, key, value) {
    src.exec(true, 'put', value, key);
    return true;
  },
  apply(src, thisArg, params) {
    return src.exec(...params);
  },
});
