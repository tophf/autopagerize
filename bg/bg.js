export const CACHE_DURATION = 24 * 60 * 60 * 1000;
export const cache = new Map();
export const cacheKeys = new Map();
export let lastAliveTime;
export {
  globalRules,
  onNavigation,
  observeNavigation,
  settings,
};

import {
  DEFAULTS,
  execScript,
  getCacheDate,
  getLocal,
  getSettings,
  isAppEnabled,
} from '/util/common.js';
import {endpoints} from './bg-api.js';
import {calcUrlCacheKey, isUrlExcluded} from './bg-util.js';

const processing = new Map();
let _globalRules = null;
let _settings = null;

if (getCacheDate() + CACHE_DURATION < Date.now())
  import('./bg-update.js').then(m =>
    m.updateSiteinfo({force: true}));

if (isAppEnabled())
  observeNavigation();

if (!localStorage.orphanMessageId)
  fetch('/manifest.json', {method: 'HEAD'}).then(r => {
    const etag = r.headers.get('ETag').replace(/\W/g, '');
    localStorage.orphanMessageId = chrome.runtime.id + ':' + etag;
  });

function globalRules(v) {
  return v ? (_globalRules = v) : _globalRules;
}

function settings(v) {
  return v ? (_settings = v) : _settings;
}

function observeNavigation() {
  const filter = {url: [{schemes: ['http', 'https']}]};
  chrome.webNavigation.onCompleted.addListener(onNavigation, filter);
  chrome.webNavigation.onHistoryStateUpdated.addListener(onNavigation, filter);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(onNavigation, filter);
}

async function onNavigation({tabId, frameId, url}) {
  if (!frameId && processing.get(tabId) !== url) {
    processing.set(tabId, url);
    if (!_settings)
      _settings = await getSettings();
    if (!isUrlExcluded(url))
      await maybeLaunch(tabId, url);
    else if (await execScript(tabId, tabNeedsDisabling) === true)
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
    await (await import('./bg-launch.js')).launch({tabId, url, rules});
}

function maybeKeepAlive() {
  lastAliveTime = Date.now();
  const {unloadAfter = DEFAULTS.unloadAfter} = _settings;
  const enabled = unloadAfter === -1 || unloadAfter > 0;
  const iframe = document.getElementsByTagName('iframe')[0];
  if (enabled && !iframe)
    document.body.appendChild(document.createElement('iframe')).src = '/bg/bg-iframe.html';
  if (!enabled && iframe)
    iframe.remove();
}

async function loadGlobalRules() {
  return globalRules(
    await getLocal('globalRules') ||
    await (await import('./bg-global-rules.js')).buildGlobalRules());
}

function tabNeedsDisabling() {
  const {launched} = window;
  delete window.launched;
  return launched;
}
