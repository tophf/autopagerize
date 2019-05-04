export const CACHE_DURATION = 24 * 60 * 60 * 1000;
export const cache = new Map();
export const cacheKeys = new Map();

let _globalRules = null;
let _settings = null;

export const globalRules = v => v ? (_globalRules = v) : _globalRules;
export const settings = v => v ? (_settings = v) : _settings;

export {
  maybeProcess,
  observeNavigation,
};

import {
  isUrlExcluded,
  calcUrlCacheKey,
} from './bg-util.js';

import {
  arrayOrDummy,
  getCacheDate,
  getLocal,
  getSettings,
  isGloballyEnabled,
} from '/util/common.js';

const processing = new Map();

if (getCacheDate() + CACHE_DURATION < Date.now())
  import('./bg-update.js').then(m =>
    m.updateSiteinfo({force: true}));

if (isGloballyEnabled())
  observeNavigation();

function observeNavigation() {
  const filter = {url: [{schemes: ['http', 'https']}]};
  chrome.webNavigation.onCompleted.addListener(maybeProcess, filter);
  chrome.webNavigation.onHistoryStateUpdated.addListener(maybeProcess, filter);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(maybeProcess, filter);
}

async function maybeProcess({tabId, frameId, url}) {
  if (!frameId && processing.get(tabId) !== url) {
    processing.set(tabId, url);
    if (!_settings)
      _settings = await getSettings();
    if (!isUrlExcluded(url))
      await maybeLaunch(tabId, url);
    processing.delete(tabId);
  }
}

async function maybeLaunch(tabId, url) {
  const [idb, key] = await Promise.all([
    import('/util/storage-idb.js'),
    calcUrlCacheKey(url),
  ]);
  const packedRules = await idb.exec({store: 'urlCache'}).get(key);
  const rules =
    packedRules && await (await import('./bg-unpack.js')).unpackRules(packedRules) ||
    await (await import('./bg-filter.js')).filterCache(url, key, packedRules);
  if (!_globalRules) {
    _globalRules = arrayOrDummy(await getLocal('globalRules'));
    if (!_globalRules.length)
      await (await import('./bg-global-rules.js')).buildGlobalRules();
  }
  rules.push(..._globalRules);
  if (rules.length)
    await (await import('./bg-launch.js')).launch(tabId, rules, key);
}
