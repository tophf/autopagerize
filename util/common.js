// inline 'export' keyword is used since everything in this module is expected to be exported

export const RETRY_TIMEOUT = 2000;

export const inBG = new Proxy({}, {
  get(_, action) {
    return data =>
      new Promise(r => chrome.runtime.sendMessage({action, data}, r));
  },
});

const STATUS_STYLE = `
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 24px;
  border: none;
  opacity: .7;
  z-index: 1000;
  margin: 0;
  padding: 0;
  color: white;
  font: bold 12px/24px sans-serif;
  text-align: center;
`.replace(/\n\s+/g, '\n').trim();

/**
 @typedef Settings
 @property {boolean} showStatus
 @property {boolean} darkTheme
 @property {number} requestInterval - seconds
 @property {number} unloadAfter - minutes
 @property {Object[]} rules
 @property {boolean} genericRulesEnabled
 @property {string[]} genericSites
 @property {string[]} exclusions
 @property {number} pageHeightThreshold - pixels
 @property {string} statusStyle
 @property {string} statusStyleError
 */
export const DEFAULTS = Object.freeze({
  showStatus: true,
  darkTheme: false,
  requestInterval: 2,
  unloadAfter: 1,
  rules: [],
  genericRulesEnabled: false,
  genericSites: ['*'],
  exclusions: [],
  pageHeightThreshold: 400,
  statusStyle: STATUS_STYLE + '\nbackground: black;',
  statusStyleError: STATUS_STYLE + '\nbackground: maroon;',
});

// content scripts should be notified when these options are changed
export const PROPS_TO_NOTIFY = [
  'showStatus',
  'statusStyle',
  'statusStyleError',
  'requestInterval',
  'pageHeightThreshold',
];

/** @return Promise<Settings> */
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

export function isGenericUrl(url) {
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
