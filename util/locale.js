export {
  i18n,
};

const TAG = /(<\S.*?>)/;

onMutation([{addedNodes: document.querySelectorAll('[tl]')}]);

if (document.readyState === 'loading') {
  const mo = new MutationObserver(onMutation);
  mo.observe(document, {subtree: true, childList: true});
  document.addEventListener('DOMContentLoaded', () => mo.disconnect(), {once: true});
}

// 'observer' is present when invoked by real mutations
// so when absent we translate all supplied elements with no further checks
function onMutation(mutations, observer) {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!observer || node.tagName && node.hasAttribute('tl')) {
        const str = i18n(node.textContent.trim());
        if (TAG.test(str))
          renderTags(node, str);
        else
          node.firstChild.nodeValue = str;
      }
    }
  }
}

function i18n(...args) {
  return chrome.i18n.getMessage(...args);
}

function renderTags(el, str) {
  el.textContent = '';
  el.append(...str.split(TAG).map(renderTagOrString));
}

function renderTagOrString(str) {
  if (str.startsWith('<') && str.endsWith('>')) {
    const el = document.createElement('b');
    el.textContent = str.slice(1, -1);
    return el;
  } else
    return str;
}
