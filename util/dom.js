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
  // look for the theme in a css file named the same as the current page
  const cssName = location.href.split('/').pop().replace(/html$/, 'css');
  const link = document.querySelector(`link[href$="${cssName}"]`);
  link.onload = function () {
    this.onload = null;
    for (const rule of link.sheet.cssRules) {
      if (rule.media && rule.media.mediaText === 'not all') {
        rule.media.deleteMedium(rule.media[0]);
        rule.media.appendMedium('screen');
        return;
      }
    }
  };
  if (link.sheet && link.sheet.cssRules.length)
    link.onload();
}
