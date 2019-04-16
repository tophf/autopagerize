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

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function ensureObject(v) {
  return v && typeof v === 'object' ? v : {};
}
