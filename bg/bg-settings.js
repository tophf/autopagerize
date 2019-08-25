export {
  writeSettings,
};

import {getSettings, ignoreLastError, packSettings, PROPS_TO_NOTIFY} from '/util/common.js';
import {settings} from './bg.js';

async function writeSettings(ss) {
  const all = settings() || await getSettings();
  if (ss.rules)
    (await import('./bg-trim.js')).trimUrlCache(all.rules, ss.rules, {main: false});
  if (ss.unloadAfter !== all.unloadAfter) {
    const iframe = document.getElementsByTagName('iframe')[0];
    iframe && iframe.remove();
  }
  // showStatus defaults to |true| so both |undefined| and |true| mean the same
  const shouldNotify = (all.showStatus !== false) !== (ss.showStatus !== false) ||
                       PROPS_TO_NOTIFY.some(k => all[k] !== ss[k]);
  const toWrite = {};
  for (const k in ss)
    if (!deepEqual(ss[k], all[k]))
      toWrite[k] = ss[k];
  await packSettings(toWrite);
  chrome.storage.sync.set(toWrite);
  Object.assign(all, ss);
  settings(all);
  mirrorThemePreference();
  if (shouldNotify)
    notify(all);
}

function mirrorThemePreference() {
  const enabled = Boolean(settings().darkTheme);
  const stored = localStorage.hasOwnProperty('darkTheme');
  if (enabled && !stored)
    localStorage.darkTheme = '';
  else if (!enabled && stored)
    delete localStorage.darkTheme;
}

function notify(ss = settings()) {
  const props = PROPS_TO_NOTIFY.map(p => p + ':' + JSON.stringify(ss[p])).join(',');
  const code = `(${passSettingsToContentScript})({${props}})`;
  chrome.tabs.query({url: '*://*/*'}, tabs =>
    tabs.forEach(tab =>
      chrome.tabs.executeScript(tab.id, {code}, ignoreLastError)));
}

function passSettingsToContentScript(settings) {
  if (typeof run === 'function')
    window.run({settings});
}

function deepEqual(a, b) {
  if (typeof a !== typeof b)
    return false;
  if (!a || !b || typeof a !== 'object')
    return a === b;
  if (Array.isArray(a))
    return Array.isArray(b) &&
           a.length === b.length &&
           a.every((v, i) => deepEqual(v, b[i]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length &&
         keys.every(k => deepEqual(a[k], b[k]));
}
