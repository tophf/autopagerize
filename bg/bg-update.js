const DATA_URL = 'http://wedata.net/databases/AutoPagerize/items_all.json';
const KNOWN_KEYS = [
  'url',
  'nextLink',
  'insertBefore',
  'pageElement',
];

/**
 * @param {object} [_]
 * @param {boolean} [_.force]
 * @param {function(ProgressEvent)} [_.onprogress]
 */
export async function updateSiteinfo({force, onprogress} = {}) {
  if (!idb)
    idb = await import('/util/storage-idb.js');
  if (!cacheUrls)
    cacheUrls = [];
  if (!force && await idb.exec().count())
    return;
  try {
    const [current, fresh] = await Promise.all([
      getCurrentSortedByCreatedAt(),
      // `fresh` is sorted using the primary method used by filtering - by url length
      sanitize(await download(onprogress)),
    ]);
    if (!fresh.length)
      return 0;
    await (await import('/bg/bg-trim.js')).trimUrlCache(current, fresh);
    await (await import('/bg/bg-load-siteinfo.js')).loadSiteinfo(fresh,
      rule => !shallowEqual(rule, current[rule.createdAt]));
    return fresh.length;
  } catch (e) {
    return e;
  }
}

async function getCurrentSortedByCreatedAt() {
  if (cache.size && cache.size === cacheUrls.length) {
    return [...cache.values()].sort((a, b) => a.createdAt - b.createdAt);
  } else {
    const all = await idb.exec().getAll();
    const ucs2 = new TextDecoder();
    for (const r of all) {
      const key = ucs2.decode(r.url);
      r.url = key.slice(1);
      r.createdAt = key.charCodeAt(0) - 32;
    }
    return all;
  }
}

function download(onprogress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', DATA_URL);
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    xhr.responseType = 'json';
    xhr.onprogress = onprogress;
    xhr.timeout = 60e3;
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = reject;
    xhr.ontimeout = reject;
    xhr.send();
  });
}

function sanitize(data) {
  return arrayOrDummy(data)
    .map(x => x && x.data && x.data.url && pickKnownKeys(x.data, x.created_at))
    .filter(Boolean)
    .sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)
    .map((x, i) => (((x.createdAt = i), x)))
    // N.B. the same sequence (createdAt then length) must be used everywhere
    .sort((a, b) => b.url.length - a.url.length)
    .map((x, i) => (((x.index = i), x)));
}

function pickKnownKeys(entry, createdAt) {
  for (const key of Object.keys(entry)) {
    if (!KNOWN_KEYS.includes(key)) {
      const newEntry = {};
      for (const k of KNOWN_KEYS) {
        const v = entry[k];
        if (v !== undefined)
          newEntry[k] = v;
      }
      entry = newEntry;
      break;
    }
  }
  entry.createdAt = createdAt;
  return entry;
}

function shallowEqual(a, b) {
  if (!a !== !b)
    return;
  for (const k in a)
    if (k !== 'index' && a[k] !== b[k])
      return;
  for (const k in b)
    if (!a.hasOwnProperty(k))
      return;
  return true;
}
