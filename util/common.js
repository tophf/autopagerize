// inline 'export' keyword is used since everything in this module is expected to be exported

export const inBG = new Proxy({}, {
  get(_, action) {
    return data =>
      new Promise(r => chrome.runtime.sendMessage({action, data}, r));
  },
});

export const DEFAULTS = Object.freeze({
  /** @type boolean */
  showStatus: true,
  /** @type boolean */
  darkTheme: false,
  /** @type number - seconds */
  requestInterval: 2,
  /** @type number - minutes */
  unloadAfter: 1,
  /** @type object[] */
  rules: [],
  /** @type string[] */
  exclusions: [],
});

export function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', data => {
      const v = data.settings;
      resolve(v && typeof v === 'object' ? v : {});
    });
  });
}

export function getLocal(key) {
  return new Promise(resolve =>
    chrome.storage.local.get(key, data =>
      resolve(data[key])));
}

export function isAppEnabled() {
  return localStorage.enabled !== 'false';
}

export function getCacheDate() {
  return Number(localStorage.cacheDate) || 0;
}

export function setCacheDate(d = Date.now()) {
  localStorage.cacheDate = d;
}

export function isGlobalUrl(url) {
  return url === '^https?://.' ||
         url === '^https?://.+';
}

export function ignoreLastError() {
  return chrome.runtime.lastError;
}

export function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}

export function execScript(tabId, options, ...codeParams) {
  if (typeof options === 'function')
    options = {code: `(${options})(${JSON.stringify(codeParams).slice(1, -1)})`};
  return new Promise(resolve => {
    chrome.tabs.executeScript(tabId, options, results => {
      ignoreLastError();
      resolve(results && results[0]);
    });
  });
}
