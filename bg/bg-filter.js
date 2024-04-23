import {arrayOrDummy, isGenericUrl} from '/util/common.js';
import {dbExec} from '/util/storage-idb.js';
import {readMissingRules} from './bg-unpack.js';
import {calcRuleKey, ruleKeyToUrl, str2rx} from './bg-util.js';
import {cache, cacheKeys, g} from './bg.js';

export function buildGenericRules() {
  return buildGenericRulesImpl.busy || (buildGenericRulesImpl.busy = buildGenericRulesImpl());
}

async function buildGenericRulesImpl() {
  if (!cacheKeys.size)
    await (loadCacheKeys.busy || (loadCacheKeys.busy = loadCacheKeys()));
  const rules = [];
  const toRead = [];
  for (const key of cacheKeys.values())
    if (isGenericUrl(key.url))
      rules.push(cache.get(key.id) || toRead.push([rules.length, key.id]));
  if (toRead.length)
    await readMissingRules(rules, toRead);
  dbExec({store: 'data'}).put(rules, 'genericRules');
  buildGenericRulesImpl.busy = null;
  return rules;
}

export async function filterCache(url, urlCacheKey, packedRules) {
  if (!cacheKeys.size)
    await (loadCacheKeys.busy || (loadCacheKeys.busy = loadCacheKeys()));
  if (!cacheKeys.size)
    await (buildSiteinfo.busy || (buildSiteinfo.busy = loadBuiltinSiteinfo()));
  if (cacheKeys.values().next().value.rx === undefined)
    regexpifyCache();
  const customRules = arrayOrDummy(g.cfg.rules);
  if (customRules.length && !customRules[0].hasOwnProperty('rx'))
    regexpifyCustomRules();
  const toUse = [];
  const toWrite = [];
  const toRead = [];
  for (let i = 0, len = customRules.length; i < len; i++) {
    const rule = customRules[i];
    if (rule.rx && rule.rx.test(url)) {
      toUse.push(rule);
      toWrite.push(-i - 1);
    }
  }
  for (const key of cacheKeys.values()) {
    const {rx} = key;
    if (!isGenericUrl(key.url) && rx &&
        (!rx.txt
          ? rx.test(url)
          : (rx.atStart ? url.startsWith(rx.txt) : url.includes(rx.txt)) ||
            rx.txt2 && (rx.atStart ? url.startsWith(rx.txt2) : url.includes(rx.txt2)))
    ) {
      const rule = cache.get(key.id);
      if (!rule)
        toRead.push([toUse.length, key.id]);
      toUse.push(rule);
      toWrite.push(key.id);
    }
  }
  if (toRead.length)
    await readMissingRules(toUse, toRead);
  if (urlCacheKey && `${toWrite}` !== `${packedRules}`)
    dbExec({store: 'urlCache'}).put(new Int32Array(toWrite), urlCacheKey);
  return toUse;
}

async function loadCacheKeys() {
  const keys = arrayOrDummy(await dbExec.getAllKeys());
  // currently URLs don't have weird characters so the length delta in UTF8 is same as in UTF16
  keys.sort((a, b) => b.length - a.length);
  cacheKeys.clear();
  for (const key of keys) {
    const rule = {
      url: ruleKeyToUrl(key),
      id: new Uint32Array(key.buffer || key, 0, 1)[0],
      rx: undefined,
    };
    cacheKeys.set(rule.id, rule);
  }
  loadCacheKeys.busy = null;
}

function regexpifyCache() {
  // many rules have an unescaped '.' in host name so we'll treat it same as '\.'
  const rxTrivial = /^(\^?)https?(\??):\/\/([-\w]*\\?\.)+[-\w/]*$/;
  for (const key of cacheKeys.values()) {
    let rx;
    const {url} = key;
    // provides a ~2x speed-up for the first run of filterCache()
    // and reduces the memory consumption by a few megs
    // by recognizing trivial/literal url expressions
    // (50% of 4000 rules at the moment)
    if (rxTrivial.test(url)) {
      const atStart = RegExp.$1 === '^';
      const hasQuestion = RegExp.$2;
      const txt = (hasQuestion ? url.replace('https?', 'http') : url).replace(/[\\?^]/g, '');
      const txt2 = hasQuestion ? 'https' + txt.slice(4) : '';
      rx = {atStart, txt, txt2};
    } else {
      try {
        rx = RegExp(url);
      } catch (e) {
        rx = null;
      }
    }
    Object.defineProperty(key, 'rx', {value: rx});
  }
}

function regexpifyCustomRules() {
  for (const r of g.cfg.rules) {
    const {url} = r;
    let rx = str2rx.get(url);
    if (rx === null)
      continue;
    if (!rx) {
      try {
        rx = RegExp(url);
      } catch (e) {
        rx = null;
      }
      str2rx.set(url, rx);
    }
    Object.defineProperty(r, 'rx', {value: rx});
  }
}

async function loadBuiltinSiteinfo() {
  const [si] = await Promise.all([
    (await fetch('/siteinfo.json')).json(),
    dbExec.clear(),
    dbExec({store: 'urlCache'}).clear(),
  ]);
  return buildSiteinfo(si);
}

export async function buildSiteinfo(si, fnCanWrite) {
  cache.clear();
  cacheKeys.clear();
  const gr = [];
  let /** @type IDBObjectStore */ store, op;
  for (const rule of si) {
    const {id, url} = rule;
    cache.set(id, rule);
    cacheKeys.set(id, rule);
    if (isGenericUrl(url))
      gr.push(rule);
    if (!fnCanWrite || fnCanWrite(rule)) {
      if (!store)
        store = await dbExec.WRITE;
      op = store.put({
        ...rule,
        url: calcRuleKey(rule),
      });
      op.onerror = console.error;
    }
  }
  g.genericRules = gr;
  store = await dbExec({store: 'data'}).WRITE;
  store.put(new Date(), 'cacheDate');
  store.put(gr, 'genericRules');
  buildSiteinfo.busy = null;
}
