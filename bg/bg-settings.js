const PROPS_TO_NOTIFY = [
  'enabled',
  'showStatus',
];

export async function writeSettings(ss) {
  const shouldNotify = await analyze(ss);
  chrome.storage.sync.set({settings: ss});
  mirrorThemePreference(ss);
  settings = ss;
  if (shouldNotify)
    notify();
}

export function mirrorThemePreference(settings) {
  const enabled = Boolean(settings.darkTheme);
  const stored = localStorage.hasOwnProperty('darkTheme');
  if (enabled && !stored)
    localStorage.darkTheme = '';
  else if (!enabled && stored)
    delete localStorage.darkTheme;
  else
    return false;
  return true;
}

async function analyze(ss) {
  if (!settings)
    settings = await getSettings();
  (await import('/bg/bg-trim.js')).trimUrlCache(settings.rules, ss.rules, {main: false});
  return PROPS_TO_NOTIFY.some(k => notFalse(settings[k]) !== notFalse(ss[k]));
}

function notify() {
  const props = PROPS_TO_NOTIFY.map(p => p + ':' + JSON.stringify(settings[p])).join(',');
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
