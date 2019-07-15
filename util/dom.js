export const $ = new Proxy({}, {
  get: (_, id) => document.getElementById(id),
});

export function onDomLoaded() {
  return document.readyState !== 'loading'
    ? Promise.resolve()
    : new Promise(r => document.addEventListener('DOMContentLoaded', r, {once: true}));
}

if ('darkTheme' in localStorage) {
  const link = [...document.getElementsByTagName('link')]
    .filter(el => el.relList.contains('stylesheet'))
    .pop();
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
