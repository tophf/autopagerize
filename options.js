/*
global $
global CACHE_DURATION
global idb
global chromeSync
global onDomLoaded
global dispatchMessageAll
global ensureArray ensureObject
*/
'use strict';

Promise.all([
  idb.get('cache'),
  chromeSync.get('settings').then(ensureObject),
  onDomLoaded(),
]).then(([
  cache = {rules: []},
  settings,
]) => {
  renderSettings(settings);
  renderSiteinfoStats(cache.rules.length, cache.expires - CACHE_DURATION);

  $.btnSave.onclick = save;
  $.btnUpdate.onclick = update;
  $.btnDiscard.onclick = async () => {
    discardDraft();
    renderSettings(await chromeSync.get('settings'));
  };

  loadDraft();
  addEventListener('input', saveDraft);
  addEventListener('change', saveDraft);
});

function renderSettings(settings) {
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
  $.updated_at.textContent = date > 0 ? new Date(date).toLocaleString() : 'N/A';
}

function parseCustomRules(str) {
  try {
    return ensureArray(JSON.parse(str));
  } catch (e) {
    alert(chrome.i18n.getMessage('custom_rules') + '\n\n' + e);
  }
}

async function save() {
  const rules = parseCustomRules($.rules.value);
  if (!rules)
    return;

  const settings = ensureObject(await chromeSync.get('settings'));

  if ($.excludes.value.trim() !== ensureArray(settings.excludes).join('\n') ||
      $.display_message_bar.checked !== settings.display_message_bar ||
      !rulesEqual(rules, ensureArray(settings.rules))) {
    settings.rules = rules;
    settings.excludes = $.excludes.value.trim().split(/\s+/);
    settings.display_message_bar = $.display_message_bar.checked;
    chromeSync.set({settings});
    dispatchMessageAll('updateSettings', settings);
  }
  discardDraft();
}

function update() {
  chrome.runtime.getBackgroundPage(async bg => {
    const btn = $.btnUpdate;
    const label = btn.textContent;
    btn.disabled = true;

    const numRules = await bg.refreshSiteinfo({
      force: true,
      onprogress(e) {
        btn.textContent = (e.loaded / 1024).toFixed(0) + ' kiB';
      },
    });

    renderSiteinfoStats(numRules, numRules > 0 ? new Date() : null);
    btn.textContent = label;
    btn.disabled = false;
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

function rulesEqual(arrayA, arrayB) {
  if (arrayA.length !== arrayB.length)
    return;
  for (let i = 0; i < arrayA.length; i++) {
    const a = arrayA[i];
    const b = arrayB[i];
    if (!a || !b)
      return;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] !== b[k])
        return;
    }
  }
  return true;
}
