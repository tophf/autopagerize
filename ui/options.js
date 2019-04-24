'use strict';

Promise.all([
  import('/util/storage-idb.js').then(idb => idb.exec().count()),
  getCacheDate(),
  getSettings(),
  getLocal('draft'),
  onDomLoaded(),
]).then(([
  cacheCount,
  cacheDate,
  settings,
  draft,
]) => {
  renderSettings(settings);
  renderSiteinfoStats(cacheCount, cacheDate);
  dispatchEvent(new CustomEvent('draftLoaded', {detail: draft}));

  $.btnSave.onclick = save;
  $.btnUpdate.onclick = update;
  $.btnDiscard.addEventListener('click', () => getSettings().then(renderSettings));
});

function renderSettings({rules, excludes, showStatus}) {
  rules = arrayOrDummy(rules).filter(r => r.url);
  if (rules.length) {
    $.rules.value = JSON.stringify(rules, null, '  ');
    $.rules.rows = Math.min(20, rules.length * 5 + 3);
    $.rules.closest('details').open = true;
  }
  excludes = arrayOrDummy(excludes);
  $.excludes.value = excludes.join('\n');
  $.excludes.rows = Math.max(2, Math.min(20, excludes.length + 1));
  $.showStatus.checked = showStatus !== false;
}

function renderSiteinfoStats(numRules, date) {
  $.size.textContent = numRules;
  $.updatedAt.textContent = date > 0 ? new Date(date).toLocaleString() : 'N/A';
}

function parseCustomRules(str) {
  let json;
  try {
    json = str.trim() ? arrayOrDummy(JSON.parse(str)) : null;
    $.warning.hidden = true;
  } catch (e) {
    $.warning.hidden = false;
    $.warning.textContent = String(e);
    $.warning.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  return json;
}

async function save() {
  const rules = parseCustomRules($.rules.value);
  if (rules === undefined)
    return;

  const settings = await getSettings();

  if ($.excludes.value.trim() !== arrayOrDummy(settings.excludes).join('\n') ||
      $.showStatus.checked !== settings.showStatus ||
      !rulesEqual(rules, settings.rules)) {
    $.rules.value = rules ? JSON.stringify(rules, null, '  ') : '';
    settings.rules = rules;
    settings.excludes = $.excludes.value.trim().split(/\s+/);
    settings.showStatus = $.showStatus.checked;
    inBG.writeSettings(settings);
  }
  dispatchEvent(new Event('optionsSaved'));
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

function rulesEqual(arrayA, arrayB) {
  arrayA = arrayOrDummy(arrayA);
  arrayB = arrayOrDummy(arrayB);
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
