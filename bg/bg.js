import {loadSettings, NOP, tabSend} from '/util/common.js';
import {dbExec} from '/util/storage-idb.js';
import {buildGenericRules, filterCache} from './bg-filter.js';
import {setIcon} from './bg-icon.js';
import {launch} from './bg-launch.js';
import {unpackRules} from './bg-unpack.js';
import {calcUrlCacheKey, isUrlExcluded, isUrlMatched} from './bg-util.js';
import './bg-api.js';

export const cache = new Map();
export const cacheKeys = new Map();
export const g = {
  genericRules: null,
  /** @type {Settings|Promise<Settings>} */
  cfg: loadSettings(),
};
const processing = new Map();
let alive, lastAlive;

toggleNav(true);

g.cfg.then(ss => {
  g.cfg = ss;
  keepAlive();
  if (!ss.enabled)
    toggleNav(false);
});

export function getGenericRules() {
  return g.genericRules || (
    g.genericRules = dbExec({store: 'data'}).get('genericRules').then(async res => (
      g.genericRules = res || await buildGenericRules()
    ))
  );
}

export function toggleNav(on) {
  const args = on ? [{url: [{urlPrefix: 'http'}]}] : [];
  const fn = on ? 'addListener' : 'removeListener';
  chrome.webNavigation.onCommitted[fn](onCommitted, ...args);
  chrome.webNavigation.onHistoryStateUpdated[fn](onNavigation, ...args);
  chrome.webNavigation.onReferenceFragmentUpdated[fn](onNavigation, ...args);
}

function onCommitted(evt) {
  return onNavigation(evt, true);
}

/**
 * @param evt
 * @param [first]
 */
export async function onNavigation(evt, first) {
  if (evt.frameId)
    return;
  const {tabId, url, timeStamp: ts} = evt;
  const p = processing.get(tabId);
  if (!first && p?.url === url)
    return;
  const tab = await chrome.tabs.get(tabId).catch(NOP);
  if (!tab?.url) // skipping pre-rendered tabs
    return;
  processing.set(tabId, {url, ts});
  if (g.cfg instanceof Promise)
    g.cfg = await g.cfg;
  if (!isUrlExcluded(url))
    await maybeLaunch(tabId, url, first);
  else if (await tabSend(tabId, ['launched', {terminate: true}]))
    setIcon({tabId, type: 'off'});
  lastAlive = performance.now();
  if (processing.get(tabId)?.ts === ts)
    processing.delete(tabId);
}

async function maybeLaunch(tabId, url, first) {
  const key = await calcUrlCacheKey(url);
  const packedRules = await dbExec({store: 'urlCache'}).get(key);
  const rules =
    packedRules?.length && await unpackRules(packedRules) ||
    await filterCache(url, key, packedRules);
  if (g.cfg.genericRulesEnabled && isUrlMatched(url, g.cfg.genericSites)) {
    const t = getGenericRules();
    rules.push(...t.then ? await t : t);
  }
  if (rules.length)
    await launch(tabId, rules, {first, url});
}

export function keepAlive(state = g.cfg.unloadAfter) {
  alive = state
    ? alive || setInterval(alivePulse, 25e3)
    : alive && clearInterval(alive);
}

function alivePulse() {
  let t;
  if (alive
  && performance.now() - lastAlive < 60e3 * ((t = g.cfg.unloadAfter) < 0 ? 1440 : t)) {
    chrome.runtime.getPlatformInfo();
  } else {
    clearInterval(alive);
    alive = 0;
  }
}
