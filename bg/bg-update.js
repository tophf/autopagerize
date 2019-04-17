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
  if (!force && await self.idb.exec(false, 'getKey', 'cache'))
    return;
  try {
    const cache = await self.idb.get('cache');
    const newCache = sanitize(await download(onprogress));
    if (newCache.length) {
      await (await import('/bg/bg-trim.js')).trimUrlCache(cache, newCache);
      await self.idb.set('cache', newCache);
      await self.chromeLocal.set('siteinfoDate', Date.now());
      if (self.runWorker)
        await self.runWorker({cacheUpdated: true});
    }
    return newCache.length;
  } catch (e) {
    return e;
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
  return self.arrayOrDummy(data)
    .map(x => x && x.data && x.data.url && pickKnownKeys(x.data))
    .filter(Boolean)
    .sort((a, b) => b.url.length - a.url.length);
}

function pickKnownKeys(entry) {
  for (const k in entry) {
    if (Object.hasOwnProperty.call(entry, k) &&
        !KNOWN_KEYS.includes(k)) {
      const newItem = {};
      for (const kk of KNOWN_KEYS) {
        const v = entry[kk];
        if (v !== undefined)
          newItem[kk] = v;
      }
      return newItem;
    }
  }
  return entry;
}
