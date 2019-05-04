// Purpose: speed up successive calls, especially in switchGlobalState()
export {
  setIcon,
};

import {
  ignoreLastError,
} from '/util/common.js';

const iconCache = new Map();
let iconBaseDir;

async function setIcon(tabId, type = '') {
  const imageData = iconCache.get(type) || await loadFromSource(type);
  chrome.browserAction.setIcon({tabId, imageData}, ignoreLastError);
}

async function loadFromSource(type = '') {
  if (!iconBaseDir)
    // strip the leading '/' and the file name
    iconBaseDir = chrome.runtime.getManifest().icons['16'].replace(/^\/|[^/]+$/g, '');
  const subdir = type ? type + '/' : '';
  const data = {};
  for (const size of [16, 32, 48])
    data[size] = await readIcon(`/${iconBaseDir}${subdir}${size}.png`);
  iconCache.set(type, data);
  return data;
}

function readIcon(path) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.src = path;
    img.onload = readIconData;
    img.onerror = reject;
    img.__resolve = resolve;
  });
}

function readIconData({target: img}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width = img.width;
  const h = canvas.height = img.height;
  ctx.drawImage(img, 0, 0, w, h);
  img.__resolve(ctx.getImageData(0, 0, w, h));
}
