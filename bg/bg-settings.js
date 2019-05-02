export {
  writeSettings,
};

const PROPS_TO_NOTIFY = [
  'showStatus',
  'requestInterval',
];

async function writeSettings(ss) {
  if (!settings)
    settings = await getSettings();
  if (ss.rules)
    (await import('/bg/bg-trim.js')).trimUrlCache(settings.rules, ss.rules, {main: false});
  const shouldNotify = PROPS_TO_NOTIFY.some(k => notFalse(settings[k]) !== notFalse(ss[k]));
  Object.assign(settings, ss);
  chrome.storage.sync.set({settings});
  mirrorThemePreference();
  if (shouldNotify)
    notify();
}

function mirrorThemePreference() {
  const enabled = Boolean(settings.darkTheme);
  const stored = localStorage.hasOwnProperty('darkTheme');
  if (enabled && !stored)
    localStorage.darkTheme = '';
  else if (!enabled && stored)
    delete localStorage.darkTheme;
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
