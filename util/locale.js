'use strict';

{
  const mo = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName && node.hasAttribute('tl')) {
          const textNode = node.firstChild;
          textNode.nodeValue = chrome.i18n.getMessage(textNode.nodeValue);
        }
      }
    }
  });
  mo.observe(document, {subtree: true, childList: true});
  document.addEventListener('DOMContentLoaded', () => mo.disconnect(), {once: true});
}
