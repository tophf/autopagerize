/**
 * @param {string} sel
 * @param {Element|Document} base
 * @return {?Element}
 */
export function $(sel, base = document) {
  return sel.startsWith('#') && !sel.includes(' ') && /^#[\w\\]+$/.test(sel) ?
    base.getElementById(sel.slice(1)) :
    base.querySelector(sel);
}

/**
 * @param {string} sel
 * @param {Element|Document} base
 * @return {NodeList}
 */
export function $$(sel, base = document) {
  return base.querySelectorAll(sel);
}

export function onDomLoaded() {
  return document.readyState !== 'loading'
    ? Promise.resolve()
    : new Promise(r => document.addEventListener('DOMContentLoaded', r, {once: true}));
}

if ('darkTheme' in localStorage) {
  for (const el of $$('link[media*="prefers-color-scheme: dark"]'))
    el.media = 'screen';
}
