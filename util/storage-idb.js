/** @type IDBDatabase */
let db = null;
const mutex = [];
const DB_NAME = 'db';
const DEFAULT_STORE_NAME = 'cache';
const EXEC_HANDLER = {
  get({cfg = {}}, method) {
    const {resolve: ok, reject: err, promise: p} = Promise.withResolvers();
    return method === 'READ' || method === 'WRITE'
      ? (doExec(cfg, method, null, ok, err), p)
      : (...args) => (doExec(cfg, method, args, ok, err), p);
  },
};
/** @typedef {IDBObjectStore | IDBIndex} IDBTarget */
/** @typedef {IDBTarget | {READ: IDBTarget} | {WRITE: IDBTarget}} IDB */
/** @type {IDB | ((cfg: ExecConfig) => IDB) } */
export const dbExec = new Proxy(cfg => new Proxy({cfg}, EXEC_HANDLER), EXEC_HANDLER);

/**
 * @typedef ExecConfig
 * @prop {String} [store=cache]
 * @prop {Boolean} [write]
 * @prop {String} [index]
 */

function doExec(/** ExecConfig */cfg, k, args, resolve, reject) {
  if (!db) {
    doOpen(cfg, k, args, resolve, reject);
    return;
  }
  const write = k === 'WRITE' || k === 'put' || k === 'clear' || k === 'delete';
  const storeName = cfg.store || DEFAULT_STORE_NAME;
  let op = db
    .transaction(storeName, write ? 'readwrite' : 'readonly')
    .objectStore(storeName);
  if (cfg.index)
    op = op.index(cfg.index);
  if (k !== 'READ' && k !== 'WRITE') {
    op = op[k](...args);
    op.__resolve = resolve;
    op.onsuccess = resolveResult;
    op.onerror = reject;
  } else {
    resolve(op);
  }
}

function doOpen(...args) {
  mutex.push(args);
  if (mutex.length > 1)
    return;
  const op = indexedDB.open(DB_NAME, 2);
  op.onsuccess = onDbOpened;
  op.onupgradeneeded = onDbUpgraded;
}

function onDbOpened(e) {
  db = e.target.result;
  while (mutex.length)
    doExec(...mutex.shift());
}

function onDbUpgraded(e) {
  db = e.target.result;
  if (!db.objectStoreNames.contains(DEFAULT_STORE_NAME))
    db.createObjectStore(DEFAULT_STORE_NAME, {keyPath: 'url'})
      .createIndex('id', 'id', {unique: true});
  for (const name of ['urlCache', 'data'])
    if (!db.objectStoreNames.contains(name))
      db.createObjectStore(name);
}

function resolveResult({target: op}) {
  return op.__resolve(op.result);
}
