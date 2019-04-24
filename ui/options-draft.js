'use strict';

(() => {
  let draftTimer, watchedElements;

  addEventListener('input', saveDraftDebounce);
  addEventListener('change', saveDraftDebounce);
  addEventListener('optionsSaved', () => {
    clearTimeout(draftTimer);
    discardDraft();
  });
  addEventListener('draftLoaded', ({detail: draft}) => {
    watchedElements = [...document.querySelectorAll('input, textarea')];
    $.btnDiscard.addEventListener('click', discardDraft);

    let someRestored;
    for (const [id, value] of arrayOrDummy(draft)) {
      const el = $[id];
      const key = getElementPropName(el);
      if (el[key] !== value) {
        el.classList.add('restored');
        el[key] = value;
        someRestored = true;
      }
    }

    if (someRestored) {
      document.body.classList.add('draft');
      $.warning.textContent = chrome.i18n.getMessage('draftRestored');
    } else {
      discardDraft();
    }
  }, {once: true});

  function saveDraft() {
    chrome.storage.local.set({
      draft: watchedElements.map(getElementValue),
    });
  }

  function saveDraftDebounce() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 100);
  }

  function discardDraft() {
    chrome.storage.local.remove('draft');
    document.body.classList.remove('draft');
  }

  function getElementValue(el) {
    return [el.id, el[getElementPropName(el)]];
  }

  function getElementPropName(el) {
    return el.type === 'checkbox' ? 'checked' : 'value';
  }
})();
