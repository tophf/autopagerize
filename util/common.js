'use strict';

const inBG = new Proxy({}, {
  get(_, action) {
    return data =>
      new Promise(r => chrome.runtime.sendMessage({action, data}, r));
  },
});

function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', data => {
      const v = data.settings;
      resolve(v && typeof v === 'object' ? v : {});
    });
  });
}

function getCacheDate() {
  return Number(localStorage.cacheDate) || 0;
}

function setCacheDate(d = Date.now()) {
  localStorage.cacheDate = d;
}

function isGlobalUrl(url) {
  return url === '^https?://.' ||
         url === '^https?://.+';
}

function ignoreLastError() {
  return chrome.runtime.lastError;
}

function arrayOrDummy(v) {
  return Array.isArray(v) ? v : [];
}
