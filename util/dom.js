'use strict';

const $ = new Proxy({}, {
  get: (_, id) => document.getElementById(id),
});

function onDomLoaded() {
  return document.readyState !== 'loading'
    ? Promise.resolve()
    : new Promise(r => document.addEventListener('DOMContentLoaded', r, {once: true}));
}
