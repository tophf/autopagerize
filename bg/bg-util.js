// inline 'export' keyword is used since everything in this module is expected to be exported

export const utf8encoder = new TextEncoder();
export const utf8decoder = new TextDecoder();

/** @type Map<String,(RegExp|null)> - null means a bad regexp */
export const str2rx = new Map();

import {
  arrayOrDummy,
} from '/util/common.js';

import {
  settings,
} from './bg.js';

// N.B. requires 'settings' to be already loaded when no 'excludes' were supplied
export function isUrlExcluded(url, excludes) {
  if (url.startsWith('https://mail.google.com/') ||
      url.startsWith('http://b.hatena.ne.jp/') ||
      url.startsWith('https://www.facebook.com/plugins/like.php') ||
      url.startsWith('http://api.tweetmeme.com/button.js'))
    return true;
  for (const entry of arrayOrDummy(excludes || settings().excludes)) {
    const isRegexp = entry.startsWith('/') && entry.endsWith('/');
    if (!isRegexp) {
      if (url === entry || url.endsWith('/') && url === entry + '/')
        return true;
      const i = entry.indexOf('*');
      if (i < 0)
        continue;
      if (i === entry.length - 1 && url.startsWith(entry.slice(0, -1)))
        return true;
    }
    let rx = str2rx.get(entry);
    if (rx === null)
      continue;
    if (!rx) {
      try {
        const rxStr = isRegexp
          ? entry.slice(1, -1)
          : '^' +
            entry.replace(/([-()[\]{}+?.$^|\\])/g, '\\$1')
              .replace(/\x08/g, '\\x08')
              .replace(/\*/g, '.*') +
            '$';
        rx = RegExp(rxStr);
        str2rx.set(entry, rx);
      } catch (e) {
        str2rx.set(entry, null);
        continue;
      }
    }
    if (rx.test(url))
      return true;
  }
}

export async function calcUrlCacheKey(url) {
  const bytes = utf8encoder.encode(url);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash).slice(0, 16);
}

export function calcRuleKey(rule) {
  const url = utf8encoder.encode(rule.url);
  const key = new Uint8Array(url.length + 4);
  new DataView(key.buffer).setUint32(0, rule.id, true);
  key.set(url, 4);
  return key;
}

export function ruleKeyToUrl(key) {
  return utf8decoder.decode(key.slice(4));
}
