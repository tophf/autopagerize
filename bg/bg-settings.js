import {DEFAULTS, ignoreLastError, getLZ} from '/util/common.js';
import {trimUrlCache} from './bg-trim.js';
import {PROPS_TO_NOTIFY, queryTabs} from './bg-util.js';
import {offscreen} from './bg-offscreen.js';
import {g, keepAlive} from './bg.js';

export async function writeSettings(ss) {
  const all = g.cfg instanceof Promise ? await g.cfg : g.cfg;
  if (ss.rules)
    trimUrlCache(all.rules, ss.rules, {main: false});
  const toWrite = {};
  let toNotify;
  for (const k in ss) {
    const v = ss[k] ?? DEFAULTS[k];
    if (v !== all[k]) {
      all[k] = v;
      toWrite[k] = v && getLZ(k, v, true);
      if (!toNotify) toNotify = PROPS_TO_NOTIFY.includes(k);
    }
  }
  chrome.storage.sync.set(toWrite);
  localStorageMirror(toWrite, 'darkTheme');
  if (toNotify)
    notify(all);
  keepAlive();
}

async function localStorageMirror(ss, key) {
  const val = ss[key];
  const stored = val != null && await offscreen.localStorageGet(key) != null;
  if (val ? !stored : stored)
    await offscreen.localStorageSet({[key]: val ? '' : null});
}

async function notify(ss = g.cfg) {
  const a1 = {};
  const opts = {
    target: {tabId: 0},
    func: settings => typeof run === 'function' && self.run({settings}),
    args: [a1],
  };
  for (const p of PROPS_TO_NOTIFY)
    a1[p] = ss[p];
  for (const tab of await queryTabs()) {
    opts.target.tabId = tab.id;
    chrome.scripting.executeScript(opts, ignoreLastError);
  }
}
