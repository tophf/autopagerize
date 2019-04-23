'use strict';

Promise.all([
  import('/util/storage-idb.js').then(idb => idb.exec().count()),
  getCacheDate(),
  getSettings(),
  onDomLoaded(),
]).then(([
  cacheCount,
  cacheDate,
  settings,
]) => {
  renderSettings(settings);
  renderSiteinfoStats(cacheCount, cacheDate);

  $.btnSave.onclick = save;
  $.btnUpdate.onclick = update;
  $.btnDiscard.onclick = async () => {
    discardDraft();
    renderSettings(await getSettings());
  };

  loadDraft();
  addEventListener('input', saveDraft);
  addEventListener('change', saveDraft);
});

function renderSettings(settings) {
  const rules = arrayOrDummy(settings.rules).filter(r => r.url);
  if (rules.length) {
    $.rules.value = JSON.stringify(rules, null, '  ');
    $.rules.rows = Math.min(20, rules.length * 5 + 3);
    $.rules.closest('details').open = true;
  }
  const excludes = arrayOrDummy(settings.excludes);
  $.excludes.value = excludes.join('\n');
  $.excludes.rows = Math.max(2, Math.min(20, excludes.length + 1));
  $.showStatus.checked = settings.showStatus !== false;
}

function renderSiteinfoStats(numRules, date) {
  $.size.textContent = numRules;
  $.updatedAt.textContent = date > 0 ? new Date(date).toLocaleString() : 'N/A';
}

function parseCustomRules(str) {
  try {
    return arrayOrDummy(JSON.parse(str));
  } catch (e) {
    alert(chrome.i18n.getMessage('customRules') + '\n\n' + e);
  }
}

async function save() {
  const rules = parseCustomRules($.rules.value);
  if (!rules)
    return;

  const settings = await getSettings();

  if ($.excludes.value.trim() !== arrayOrDummy(settings.excludes).join('\n') ||
      $.showStatus.checked !== settings.showStatus ||
      !rulesEqual(rules, arrayOrDummy(settings.rules))) {
    settings.rules = rules;
    settings.excludes = $.excludes.value.trim().split(/\s+/);
    settings.showStatus = $.showStatus.checked;
    inBG.writeSettings(settings);
  }
  discardDraft();
}

async function update() {
  const btn = $.btnUpdate;
  const label = btn.textContent;
  btn.disabled = true;

  const portName = performance.now() + '.' + Math.random();
  chrome.runtime.onConnect.addListener(port => {
    if (port.name === portName)
      port.onMessage.addListener(loaded => {
        btn.textContent = (loaded / 1024).toFixed(0) + ' kiB';
      });
  });
  const numRules = await inBG.updateSiteinfo(portName);

  renderSiteinfoStats(numRules, numRules > 0 ? new Date() : null);
  btn.textContent = label;
  btn.disabled = false;
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
