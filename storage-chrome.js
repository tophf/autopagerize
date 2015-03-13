'use strict';

const chromeStorage = new Proxy(() => {}, {
  get(_, key) {
    return new Promise(resolve => {
      chrome.storage.sync.get(key, data => resolve(data[key]));
    });
  },
  set(_, key, value) {
    chrome.storage.sync.set({[key]: value});
    return true;
  },
  apply(_, _thisArg, args) {
    return new Promise(resolve => {
      chrome.storage.sync.get(args, resolve);
    });
  },
});
