'use strict';

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
