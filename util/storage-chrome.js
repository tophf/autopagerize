class ChromeStorage {
  constructor(area) {
    /** @type chrome.storage.StorageArea */
    this.area = area;
  }
  /**
   * get('key') -> value
   * get(['key1', 'key2']) -> {key1: val1, key2: val2}
   * get({key1: default1, key2: default2}) -> {key1: val1, key2: val2}
   * @param {String|String[]|Object} keyOrData
   */
  get(keyOrData) {
    return new Promise(resolve => {
      this.area.get(keyOrData, data => {
        resolve(typeof keyOrData === 'string' ? data[keyOrData] : data);
      });
    });
  }
  /**
   * ensures the returned value for the specified string key is a non-null object
   * @param {String} key
   */
  getObject(key) {
    return new Promise(resolve => {
      this.area.get(key, data => {
        const v = data[key];
        resolve(v && typeof v === 'object' ? v : {});
      });
    });
  }

  /**
   * set('key', value)
   * set({key1: val1, key2: val2})
   * @param {String|Object} keyOrData
   * @param {*} [data]
   */
  set(keyOrData, data) {
    return new Promise((resolve, reject) => {
      this.area.set(
        typeof keyOrData === 'string'
          ? {[keyOrData]: data}
          : keyOrData,
        () => chrome.runtime.lastError ? reject() : resolve());
    });
  }
}

window.chromeSync = new ChromeStorage(chrome.storage.sync);
window.chromeLocal = new ChromeStorage(chrome.storage.local);
