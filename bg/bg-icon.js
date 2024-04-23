// Purpose: speed up successive calls, especially in switchGlobalState()
import {ignoreLastError} from '/util/common.js';

const iconCache = {};
let iconBaseDir;

export async function setIcon({tabId, type = ''}) {
  let res = iconCache[type] || (iconCache[type] = loadFromSource(type));
  if (res.then) res = iconCache[type] = await res;
  chrome.action.setIcon({tabId, imageData: res}, ignoreLastError);
}

async function loadFromSource(type = '') {
  if (!iconBaseDir)
    // strip the leading '/' and the file name
    iconBaseDir = chrome.runtime.getManifest().icons['16'].replace(/^\/|[^/]+$/g, '');
  const dir = `/${iconBaseDir}${type ? type + '/' : ''}`;
  const results = await Promise.all([16, 32, 48].map(readIcon, dir));
  return Object.fromEntries(results);
}

/** @this {String} */
async function readIcon(size) {
  const img = await createImageBitmap(await (await fetch(`${this}${size}.png`)).blob());
  const {width: w, height: h} = img;
  const ctx = new OffscreenCanvas(w, h).getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return [size, ctx.getImageData(0, 0, w, h)];
}
