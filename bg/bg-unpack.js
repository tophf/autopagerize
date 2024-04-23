import {arrayOrDummy} from '/util/common.js';
import {dbExec} from '/util/storage-idb.js';
import {ruleKeyToUrl} from './bg-util.js';
import {cache, cacheKeys, g} from './bg.js';

// (!) `cfg` must be already loaded
export async function unpackRules(packedRules) {
  const customRules = arrayOrDummy(g.cfg.rules);
  const unpackedRules = [];
  const toRead = [];
  for (const id of packedRules) {
    let r;
    if (id < 0) {
      r = customRules[-id - 1];
      if (!r)
        return;
    } else {
      r = cache.get(id);
      !r && toRead.push([unpackedRules.length, id]);
    }
    unpackedRules.push(r);
  }
  return toRead.length
    ? readMissingRules(unpackedRules, toRead)
    : unpackedRules;
}

export async function readMissingRules(rules, toRead) {
  const pr = Promise.withResolvers();
  const index = await dbExec({index: 'id'}).READ;
  index.__rules = rules;
  let /** @type Req */ op;
  for (const [arrayPos, id] of toRead) {
    op = index.get(id);
    op.__arrayPos = arrayPos;
    op.onsuccess = readRule;
    op.onerror = console.error;
  }
  op.__resolve = pr.resolve;
  op.onerror = () => pr.resolve(false);
  return pr.promise;
}

function readRule(e) {
  const op = /** @type Req */ e.target;
  const r = op.result;
  if (!r) {
    op.transaction.abort();
    return;
  }
  const old = cacheKeys.get(r.id);
  if (!old)
    r.url = ruleKeyToUrl(r.url);
  else {
    r.url = old.url;
    'rx' in old && Object.defineProperty(r, 'rx', {value: old.rx});
  }
  cache.set(r.id, r);
  op.source.__rules[op.__arrayPos] = r;
  if (op.__resolve)
    op.__resolve(op.source.__rules);
}

/**
 * @typedef {IDBRequest & {
 *   __resolve: function,
 *   __arrayPos: number,
 *   source: IDBIndex & {__rules: {}},
 * }} Req
 */
