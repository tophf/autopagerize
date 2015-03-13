'use strict';

const CACHE_DURATION = 24 * 60 * 60 * 1000;

const idbStorage = new Proxy({
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
          .objectStore(this.STORE)[method](...params);
        op.onsuccess = () => resolve(op.result);
        op.onerror = reject;
      };
    });
  }
}, {
  get(src, key) {
    return src.exec(false, 'get', key);
  },
  set(src, key, value) {
    src.exec(true, 'put', value, key);
    return true;
  },
});
