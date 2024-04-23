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

export function toggleDarkTheme(force = 'darkTheme' in localStorage) {
  for (const el of $$('link[media]'))
    el.media = force ? 'screen' : '(prefers-color-scheme: dark)';
}

toggleDarkTheme();
chrome.storage.sync.onChanged.addListener(ch => {
  if ((ch = ch.darkTheme))
    toggleDarkTheme(ch.newValue);
});
