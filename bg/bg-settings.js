/*
global settings
global getSettings
global ignoreLastError
*/

const PROPS_TO_NOTIFY = [
  'enabled',
  'display_message_bar',
];

export async function writeSettings(ss) {
  const shouldNotify = await analyze(ss);
  chrome.storage.sync.set({settings: ss});
  self.settings = ss;
  if (shouldNotify)
    notify();
}

async function analyze(ss) {
  if (!settings)
    self.settings = await getSettings();
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
  if (typeof window.run === 'function')
    window.run([], null, settings);
}

function notFalse(val) {
  return val !== false;
}
