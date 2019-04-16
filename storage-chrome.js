'use strict';

const chromeSync = {
  /**
   * get('key') -> value
   * get(['key1', 'key2']) -> {key1: val1, key2: val2}
   * get({key1: default1, key2: default2}) -> {key1: val1, key2: val2}
   * @param {String|String[]|Object} keyOrData
   */
  get(keyOrData) {
    return new Promise(resolve => {
      chrome.storage.sync.get(keyOrData, data => {
        resolve(typeof keyOrData === 'string' ? data[keyOrData] : data);
      });
    });
  },
  /**
   * set('key', value)
   * set({key1: val1, key2: val2})
   * @param {String|Object} keyOrData
   * @param {*} [data]
   */
  set(keyOrData, data) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(
        typeof keyOrData === 'string'
          ? {[keyOrData]: data}
          : keyOrData,
        () => chrome.runtime.lastError ? reject() : resolve());
    });
  },
};
