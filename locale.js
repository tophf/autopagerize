'use strict';

{
  const mo = new MutationObserver(mutations => {
    for (var i = 0, m; (m = mutations[i++]);) {
      for (var j = 0, added = m.addedNodes, node; (node = added[j++]);) {
        if (node.tagName && node.hasAttribute('tl')) {
          var textNode = node.childNodes[0];
          textNode.nodeValue = chrome.i18n.getMessage(textNode.nodeValue);
        }
      }
    }
  });
  mo.observe(document, {subtree: true, childList: true});
  document.addEventListener('DOMContentLoaded', () => mo.disconnect(), {once: true});
}
