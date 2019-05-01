export {
  collectSettings,
  renderSettings,
};

import {
  collectRules,
  loadRules,
} from './options-rules.js';

const changedElements = new Set();

Promise.all([
  import('/util/storage-idb.js').then(idb => idb.exec().count()),
  getCacheDate(),
  getSettings(),
  onDomLoaded().then(() => {
    import('./options-backup.js');
  }),
]).then(([
  cacheCount,
  cacheDate,
  settings,
]) => {
  renderSettings(settings);
  renderSiteinfoStats(cacheCount, cacheDate);
  loadRules(settings.rules);

  $.btnSave.onclick = save;
  $.btnUpdate.onclick = update;
  $.backup.oninput = ({target: el}) => ($.importWrapper.disabled = !el.value.trim());
  addEventListener('input', onChange, {passive: true});
  addEventListener('change', onChange, {passive: true});
});

function renderSettings(ss) {
  let el;

  el = $.excludes;
  el.value = el.savedValue = arrayOrDummy(ss.excludes).join('\n');
  el.rows = Math.max(2, Math.min(20, arrayOrDummy(ss.excludes).length + 1));

  el = $.showStatus;
  el.checked = el.savedValue = ss.showStatus !== false;

  el = $.darkTheme;
  el.checked = el.savedValue = ss.darkTheme === true;

  el = $.requestInterval;
  el.value = el.savedValue = String(ss.requestInterval || 2);
}

function renderSiteinfoStats(numRules, date) {
  $.size.textContent = numRules;
  date = date > 0 ? new Date(date) : '';
  $.date.dateTime = date;
  $.date.textContent = date ? renderDate(date) : 'N/A';
  $.date.title = date && date.toLocaleString();
}

function renderDate(date) {
  if (Intl.RelativeTimeFormat) {
    let delta = (date - Date.now()) / 1000;
    for (const [span, unit] of [
      [60, 'second'],
      [60, 'minute'],
      [24, 'hour'],
      [7, 'day'],
      [4, 'week'],
      [12, 'month'],
      [1e99, 'year'],
    ]) {
      if (Math.abs(delta) < span)
        return new Intl.RelativeTimeFormat({style: 'short'}).format(Math.round(delta), unit);
      delta /= span;
    }
  }
  return date.toLocaleString();
}

async function save() {
  const settings = await getSettings();
  const ss = collectSettings();
  const task = inBG.writeSettings({...settings, ...ss});
  if (ss.darkTheme !== settings.darkTheme) {
    await task;
    location.reload();
    return;
  }

  $.excludes.savedValue = ss.excludes.join('\n');
  $.showStatus.savedValue = ss.showStatus;
  $.darkTheme.savedValue = ss.darkTheme;
  $.requestInterval.savedValue = String(ss.requestInterval);

  changedElements.forEach(el => el.classList.remove('changed'));
  changedElements.clear();
  for (const el of $.rules.getElementsByClassName('deleted'))
    el.savedValue = !el.savedValue;

  $.btnSaveWrapper.hidden = true;
}

async function update() {
  const btn = $.btnUpdate;
  const label = btn.textContent;
  btn.disabled = true;

  chrome.runtime.onConnect.addListener(displayProgress);
  const portName = performance.now() + '.' + Math.random();
  const numRules = await inBG.updateSiteinfo(portName);
  chrome.runtime.onConnect.removeListener(displayProgress);

  renderSiteinfoStats(numRules, numRules > 0 ? new Date() : null);
  btn.textContent = label;
  btn.disabled = false;

  function displayProgress(port) {
    if (port.name === portName)
      port.onMessage.addListener(loaded => {
        btn.textContent = (loaded / 1024).toFixed(0) + ' kiB';
      });
  }
}

function collectSettings() {
  return {
    rules: collectRules(),
    excludes: $.excludes.value.trim().split(/\s+/),
    showStatus: $.showStatus.checked,
    darkTheme: $.darkTheme.checked,
    requestInterval: $.requestInterval.valueAsNumber || 2,
  };
}

function onChange({target: el}) {
  if (el.closest('.ignore-changes'))
    return;
  const value = el[el.type === 'checkbox' ? 'checked' : 'value'];
  const changed = value !== el.savedValue;
  if (changed)
    changedElements.add(el);
  else
    changedElements.delete(el);
  if (changed !== el.classList.contains('changed'))
    el.classList.toggle('changed', changed);
  const unsalvageable = !changedElements.size || (el.checkValidity && !el.checkValidity());
  const btn = $.btnSaveWrapper;
  if (btn.hidden !== unsalvageable)
    btn.hidden = unsalvageable;
}
