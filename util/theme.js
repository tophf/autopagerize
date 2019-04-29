'use strict';

if ('darkTheme' in localStorage) {
  const sheet = document.styleSheets[document.styleSheets.length - 1];
  sheet.ownerNode.onload = function () {
    this.onload = null;
    for (const rule of sheet.cssRules) {
      if (rule.media) {
        rule.media.deleteMedium(rule.media[0]);
        rule.media.appendMedium('screen');
        return;
      }
    }
  };
}
