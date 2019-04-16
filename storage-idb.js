'use strict';

const CACHE_DURATION = 24 * 60 * 60 * 1000;
const URL_CACHE_PREFIX = 'cache:';
const MAX_CACHEABLE_URL_LENGTH = 1000;

const idb = {
  DB_NAME: 'db',
  STORE_NAME: 'store',
  CLOSE_TIMEOUT: 2000,
  /** @type IDBDatabase */
  _db: null,
  _dbCloseTimer: null,
  get(key) {
    return idb.exec(false, 'get', key);
  },
  set(key, value) {
    return idb.exec(true, 'put', value, key);
  },
  close() {
    idb.cancelClosing();
    if (idb._db) {
      idb._db.close();
      idb._db = null;
    }
  },
  cancelClosing() {
    if (idb._dbCloseTimer) {
      clearTimeout(idb._dbCloseTimer);
      idb._dbCloseTimer = null;
    }
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
  _execRaw(readWrite, method, params, resolve, reject) {
    idb.cancelClosing();
    let op = idb._db
      .transaction(idb.STORE_NAME, readWrite ? 'readwrite' : 'readonly')
      .objectStore(idb.STORE_NAME);
    if (method) {
      idb._dbCloseTimer = setTimeout(idb.close, idb.CLOSE_TIMEOUT);
      op = op[method](...params);
      op.onsuccess = () => resolve(op.result);
      op.onerror = reject;
    } else {
      resolve(op);
    }
  },
};
