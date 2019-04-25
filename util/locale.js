'use strict';

{
  const mo = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName && node.hasAttribute('tl')) {
          const textNode = node.firstChild;
          textNode.nodeValue = i18n(textNode.nodeValue.trim());
        }
      }
    }
  });
  mo.observe(document, {subtree: true, childList: true});
  document.addEventListener('DOMContentLoaded', () => mo.disconnect(), {once: true});
}

function i18n(...args) {
  return chrome.i18n.getMessage(...args);
}
