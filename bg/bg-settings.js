export {
  writeSettings,
};

import {getSettings, ignoreLastError} from '/util/common.js';
import {settings} from './bg.js';

const PROPS_TO_NOTIFY = [
  'showStatus',
  'requestInterval',
];

async function writeSettings(ss) {
  const all = settings() || await getSettings();
  if (ss.rules)
    (await import('./bg-trim.js')).trimUrlCache(all.rules, ss.rules, {main: false});
  if (ss.unloadAfter !== all.unloadAfter) {
    const iframe = document.getElementsByTagName('iframe')[0];
    iframe && iframe.remove();
  }
  const shouldNotify = PROPS_TO_NOTIFY.some(k => notFalse(all[k]) !== notFalse(ss[k]));
  Object.assign(all, ss);
  chrome.storage.sync.set({settings: all});
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

function notFalse(val) {
  return val !== false;
}
