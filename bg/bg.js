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
  endpoints,
} from './bg-api.js';

import {
  isUrlExcluded,
  calcUrlCacheKey,
} from './bg-util.js';

import {
  DEFAULT_SETTINGS,
  getCacheDate,
  getLocal,
  getSettings,
  executeScript,
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
    else if (await executeScript(tabId, needsDisabling) === true)
      await endpoints().setIcon({tabId, type: 'off'});
    processing.delete(tabId);
    maybeKeepAlive();
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
  rules.push(..._globalRules || await loadGlobalRules());
  if (rules.length)
    await (await import('./bg-launch.js')).launch({tabId, rules});
}

async function loadGlobalRules() {
  return globalRules(
    await getLocal('globalRules') ||
    await (await import('./bg-global-rules.js')).buildGlobalRules());
}

function maybeKeepAlive() {
  const {unloadAfter = DEFAULT_SETTINGS.unloadAfter} = _settings;
  const enabled = unloadAfter === -1 || unloadAfter > 0;
  const iframe = document.getElementsByTagName('iframe')[0];
  if (enabled && !iframe)
    document.body.appendChild(document.createElement('iframe')).src = '/bg/bg-iframe.html';
  if (!enabled && iframe)
    iframe.remove();
}

function needsDisabling() {
  const {launched} = window;
  delete window.launched;
  return launched;
}
