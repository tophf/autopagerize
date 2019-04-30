'use strict';

const $ = new Proxy({}, {
  get: (_, id) => document.getElementById(id),
});

function onDomLoaded() {
  return document.readyState !== 'loading'
    ? Promise.resolve()
    : new Promise(r => document.addEventListener('DOMContentLoaded', r, {once: true}));
}

if ('darkTheme' in localStorage) {
  const sheet = document.styleSheets[document.styleSheets.length - 1];
  sheet.ownerNode.onload = function () {
    this.onload = null;
    for (const rule of sheet.cssRules) {
      if (rule.media && rule.media.mediaText === 'not all') {
        rule.media.deleteMedium(rule.media[0]);
        rule.media.appendMedium('screen');
        return;
      }
    }
  };
  if (sheet.cssRules.length)
    sheet.ownerNode.onload();
}
