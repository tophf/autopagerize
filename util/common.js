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

/**
 * @param {string|string[]} key
 * @return Promise<any|Settings>
 */
export function getSettings(key = Object.keys(DEFAULTS)) {
  return new Promise(resolve => {
    chrome.storage.sync.get(key, async ss => {
      const isKeyArray = Array.isArray(key);
      if (isKeyArray ? key.some(isLZSetting) : isLZSetting(key))
        await unpackSettings(ss);
      resolve(isKeyArray ? ss : ss[key]);
    });
  });
}

export async function packSettings(ss) {
  for (const k in ss) {
    const lz = isLZSetting(k);
    if (lz) {
      const LZString = window.LZString || await loadLZString();
      const v = lz === 'json' ? JSON.stringify(ss[k]) : ss[k];
      // empty strings are stored as is because LZString increases them to 2 chars
      ss[k] = v ? LZString.compressToUTF16(v) : '';
    }
  }
}

export async function unpackSettings(ss) {
  for (const k in ss) {
    const lz = isLZSetting(k);
    if (lz) {
      try {
        const LZString = window.LZString || await loadLZString();
        // empty strings are stored as is because LZString increases them to 2 chars
        // (un-lzipping an empty string produces null)
        const v = LZString.decompressFromUTF16(ss[k]) || '';
        ss[k] = lz === 'json' ? JSON.parse(v) : v;
      } catch (e) {
        console.error('Cannot unpack', k, ss[k]);
      }
    }
  }
}

export function isLZSetting(key) {
  const v = DEFAULTS[key];
  return typeof v === 'string' || Array.isArray(v) && 'json';
}

export function loadLZString() {
  return new Promise(resolve => {
    const el = document.createElement('script');
    el.src = '/vendor/lz-string-unsafe/lz-string.min.js';
    el.addEventListener('load', () => resolve(window.LZString), {once: true});
    document.head.appendChild(el);
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
