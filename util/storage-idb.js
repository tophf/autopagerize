/** @module storage-idb */

export const DB_NAME = 'db';
export const DEFAULT_STORE_NAME = 'cache';

/** @type IDBDatabase */
let db = null;

/**
 * @typedef ExecConfig
 * @prop {String} [store=cache]
 * @prop {Boolean} [write]
 * @prop {String} [index]
 */

const ARGS_KEY = Symbol('idb');

const EXEC_HANDLER = {
  get(cfg, method) {
    return method === 'RAW'
      ? new Promise((ok, err) => doExec(cfg, null, null, ok, err))
      : (...args) => new Promise((ok, err) => doExec(cfg, method, args, ok, err));
  },
};

/**
 * @param {ExecConfig} [cfg]
 * @return {IDBObjectStore|IDBIndex}
 */
export function exec(cfg = {}) {
  return new Proxy(cfg, EXEC_HANDLER);
}

/**
 * @param {ExecConfig} [cfg]
 * @return {IDBObjectStore|IDBIndex}
 */
export function execRW(cfg = {}) {
  return exec({...cfg, write: true});
}

function doExec(/** ExecConfig */cfg, method, args, resolve, reject) {
  if (!db) {
    doOpen(cfg, method, args, resolve, reject);
    return;
  }
  const storeName = cfg.store || DEFAULT_STORE_NAME;
  let op = db
    .transaction(storeName, cfg.write ? 'readwrite' : 'readonly')
    .objectStore(storeName);
  if (cfg.index)
    op = op.index(cfg.index);
  if (method) {
    op = op[method](...args);
    op.onsuccess = () => resolve(op.result);
    op.onerror = reject;
  } else {
    resolve(op);
  }
}

function doOpen(...args) {
  const op = indexedDB.open(DB_NAME);
  op[ARGS_KEY] = args;
  op.onsuccess = onDbOpened;
  op.onupgradeneeded = onDbUpgraded;

}

function onDbOpened(e) {
  db = e.target.result;
  doExec(...e.target[ARGS_KEY]);
}

function onDbUpgraded(e) {
  // ordered by created_at that doesn't change for a given rule
  // thus only the changed/added rules will be rewritten on update
  e.target.result.createObjectStore(DEFAULT_STORE_NAME, {keyPath: 'url'})
    .createIndex('index', 'index', {unique: true});
  e.target.result.createObjectStore('urlCache');
}
