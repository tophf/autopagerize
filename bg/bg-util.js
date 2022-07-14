export {
  calcRuleKey,
  calcUrlCacheKey,
  isUrlExcluded,
  isUrlMatched,
  ruleKeyToUrl,
};

export const utf8encoder = new TextEncoder();
export const utf8decoder = new TextDecoder();
/** @type Map<String,(RegExp|null)> - null means a bad regexp */
export const str2rx = new Map();

import {arrayOrDummy} from '/util/common.js';
import {settings} from './bg.js';

// N.B. requires 'settings' to be already loaded when no 'exclusions' were supplied
function isUrlExcluded(url, exclusions) {
  return (
    url.startsWith('https://mail.google.com/') ||
    url.startsWith('http://b.hatena.ne.jp/') ||
    url.startsWith('https://www.facebook.com/plugins/like.php') ||
    url.startsWith('http://api.tweetmeme.com/button.js') ||
    isUrlMatched(url, exclusions || settings().exclusions)
  );
}

function isUrlMatched(url, patterns) {
  for (const entry of arrayOrDummy(patterns)) {
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
    const rx = str2rx.get(entry);
    if (rx !== null && (rx || compilePattern(entry, isRegexp)).test(url))
      return true;
  }
}

function compilePattern(str, isRegexp) {
  let rx;
  try {
    const rxStr = isRegexp
      ? str.slice(1, -1)
      : '^' +
        str.replace(/([-()[\]{}+?.$^|\\])/g, '\\$1')
          .replace(/\x08/g, '\\x08')
          .replace(/\*/g, '.*') +
        '$';
    rx = RegExp(rxStr);
  } catch (e) {
    rx = null;
  }
  str2rx.set(str, rx);
  return rx;
}

async function calcUrlCacheKey(url) {
  const bytes = utf8encoder.encode(url);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(hash).slice(0, 16);
}

function calcRuleKey(rule) {
  const url = utf8encoder.encode(rule.url);
  const key = new Uint8Array(url.length + 4);
  new Uint32Array(key.buffer, 0, 1)[0] = rule.id;
  key.set(url, 4);
  return key;
}

function ruleKeyToUrl(key) {
  return utf8decoder.decode(key.slice(4));
}
