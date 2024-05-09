// inline 'export' keyword is used since everything in this module is expected to be exported

import {compressToUTF16, decompressFromUTF16} from './lz-string.js';

export const RETRY_TIMEOUT = 2;
export const NOP = () => {};
export const inBG = new Proxy({}, {
  get: (_, action) => (...data) => chrome.runtime.sendMessage({action, data}),
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
  transition: opacity 1s;
`.replace(/\n\s+/g, '\n').trim();

/** @namespace Settings */
export const DEFAULTS = Object.freeze({
  showStatus: true,
  darkTheme: false,
  enabled: true,
  /** seconds */
  requestInterval: 2,
  /** minutes */
  unloadAfter: 1,
  rules: [],
  genericRulesEnabled: false,
  genericSites: ['*'],
  exclusions: [],
  /** pixels */
  pageHeightThreshold: 400,
  statusStyle: STATUS_STYLE + '\nbackground: black;',
  statusStyleError: STATUS_STYLE + '\nbackground: maroon;',
});

export const getActiveTab = async () =>
  (await chrome.tabs.query({active: true, currentWindow: true}))[0];

for (const ns of ['runtime', 'tabs']) {
  const obj = chrome[ns];
  const fn = obj.sendMessage;
  obj.sendMessage = async (...args) => {
    const {stack} = new Error();
    try {
      return await fn.apply(obj, args);
    } catch (err) {
      err.stack += '\nPrior to sendMessage:\n' + stack;
      throw err;
    }
  };
}

/**
 * @param {string|string[]} key
 * @return {Promise<Settings>}
 */
export async function loadSettings(key = Object.keys(DEFAULTS)) {
  const res = await chrome.storage.sync.get(key);
  const isKeyArray = Array.isArray(key);
  for (const k of isKeyArray ? key : [key]) {
    let v = res[k];
    if (v == null)
      res[k] = DEFAULTS[k];
    else if (v && (v = getLZ(k, v, false)))
      res[k] = v;
  }
  return isKeyArray ? res : res[key];
}

export function getLZ(key, val, write) {
  if (!val) return val;
  let json;
  const d = DEFAULTS[key];
  if (typeof d === 'string' || (json = Array.isArray(d))) {
    try {
      val = write ? compressToUTF16(json ? JSON.stringify(val) : val)
        : json ? JSON.parse(decompressFromUTF16(val)) :
          decompressFromUTF16(val);
    } catch (err) {
      console.warn(err, key, val);
    }
  }
  return val;
}

export function isGenericUrl(url) {
  return url === '^https?://.' ||
         url === '^https?://.+';
}

export function ignoreLastError() {
  chrome.runtime.lastError; // eslint-disable-line no-unused-expressions
}

export function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}

export function doDelay(seconds) {
  const pr = Promise.withResolvers();
  setTimeout(pr.resolve, seconds * 1000);
  return pr.promise;
}

export function tabSend(tabId, msg) {
  return chrome.tabs.sendMessage(tabId, msg, {frameId: 0}).catch(NOP);
}
