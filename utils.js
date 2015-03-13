'use strict';

const $ = new Proxy({}, {
  get: (_, id) => document.getElementById(id),
});

function onDomLoaded() {
  return document.readyState !== 'loading'
    ? Promise.resolve()
    : new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, {once: true}));
}

function ignoreLastError() {
  return chrome.runtime.lastError;
}

function dispatchMessageAll(name, data) {
  chrome.tabs.query({url: '*://*/*'}, tabs => {
    const msg = {name, data};
    for (const tab of tabs) {
      if (!tab.discarded && tab.width)
        chrome.tabs.sendMessage(tab.id, msg, {frameId: 0}, ignoreLastError);
    }
  });
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function ensureObject(v) {
  return v && typeof v === 'object' ? v : {};
}
