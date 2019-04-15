/*
global $
global CACHE_DURATION
global idbStorage
global chromeStorage
global onDomLoaded
global dispatchMessageAll
global ensureArray ensureObject
*/
'use strict';

Promise.all([
  idbStorage.cache,
  chromeStorage.settings,
  onDomLoaded(),
]).then(([
  cache = {rules: []},
  settings,
]) => {
  renderSettings(settings);
  renderSiteinfoStats(cache.rules.length, cache.expires - CACHE_DURATION);

  $.btnSave.onclick = save;
  $.btnUpdate.onclick = update;
  $.btnDiscard.onclick = () => {
    discardDraft();
    chromeStorage.settings.then(renderSettings);
  };

  loadDraft();
  addEventListener('input', saveDraft);
  addEventListener('change', saveDraft);
});

function renderSettings(settings) {
  settings = ensureObject(settings);
  const rules = ensureArray(settings.rules).filter(r => r.url);
  if (rules.length) {
    $.rules.value = JSON.stringify(rules, null, '  ');
    $.rules.rows = Math.min(20, rules.length * 5 + 3);
    $.rules.closest('details').open = true;
  }
  const excludes = ensureArray(settings.excludes);
  $.excludes.value = excludes.join('\n');
  $.excludes.rows = Math.max(2, Math.min(20, excludes.length + 1));
  $.display_message_bar.checked = settings.display_message_bar !== false;
}

function renderSiteinfoStats(numRules, date) {
  $.size.textContent = numRules;
  $.updated_at.textContent = date ? new Date(date).toLocaleString() : 'N/A';
}

function parseCustomRules(str) {
  try {
    let rules = JSON.parse(str);
    if (!Array.isArray(rules))
      rules = [rules];
    return rules;
  } catch (e) {
    alert(chrome.i18n.getMessage('custom_rules') + '\n\n' + e);
  }
}

async function save() {
  const rules = parseCustomRules($.rules.value);
  if (!rules)
    return;

  const settings = ensureObject(await chromeStorage.settings);

  const changed =
    $.excludes.value.trim() !== ensureArray(settings.excludes).join('\n') ||
    $.display_message_bar.checked !== settings.display_message_bar ||
    !deepEqual(rules, ensureArray(settings.rules));
  if (!changed)
    return;

  settings.rules = rules;
  settings.excludes = $.excludes.value.trim().split(/\s+/);
  settings.display_message_bar = $.display_message_bar.checked;
  chromeStorage.settings = settings;

  discardDraft();
  dispatchMessageAll('updateSettings', settings);
}

function update() {
  chrome.runtime.getBackgroundPage(async bg => {
    $.btnUpdate.disabled = true;
    const numRules = await bg.refreshSiteinfo({force: true});
    renderSiteinfoStats(numRules, numRules > 0 ? new Date() : null);
    $.btnUpdate.disabled = false;
  });
}

function loadDraft() {
  try {
    let someRestored;
    for (const {id, value} of JSON.parse(localStorage.draft)) {
      const el = $[id];
      const key = el.type === 'checkbox' ? 'checked' : 'value';
      if (el[key] !== value) {
        el.classList.add('restored');
        el[key] = value;
        someRestored = true;
      }
    }
    if (someRestored)
      document.body.classList.add('draft');
    else
      delete localStorage.draft;
  } catch (e) {}
}

function saveDraft(debounced) {
  if (debounced === true) {
    const elements = [...document.querySelectorAll('input, textarea')];
    localStorage.draft = JSON.stringify(
      elements.map(el => ({
        id: el.id,
        value: el.type === 'checkbox' ? el.checked : el.value,
      })));
  } else {
    clearTimeout(saveDraft.timer);
    saveDraft.timer = setTimeout(saveDraft, 200, true);
  }
}

function discardDraft() {
  delete localStorage.draft;
  document.body.classList.remove('draft');
}

function deepEqual(a, b) {
  const typeA = typeof a;
  if (typeA !== typeof b)
    return;
  // simple
  if (typeA !== 'object' || !a || !b)
    return a === b;
  // arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return;
    const checkedIndexes = [];
    let minUncheckedIndex = 0;
    nextA:
    for (const el of a) {
      for (let i = minUncheckedIndex; i < b.length; i++) {
        if (checkedIndexes[i] || !deepEqual(el, b[i]))
          continue;
        if (i === minUncheckedIndex)
          minUncheckedIndex++;
        else
          checkedIndexes[i] = 1;
        continue nextA;
      }
      return;
    }
    return true;
  }
  // objects
  for (const keyA in a) {
    if (Object.hasOwnProperty.call(a, keyA)) {
      if (!Object.hasOwnProperty.call(b, keyA) || !deepEqual(a[keyA], b[keyA]))
        return;
    }
  }
  return true;
}
