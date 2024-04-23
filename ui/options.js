export {
  collectSettings,
  renderSettings,
};

import {arrayOrDummy, DEFAULTS, loadSettings, inBG} from '/util/common.js';
import {$, $$} from '/util/dom.js';
import {dbExec} from '/util/storage-idb.js';
import {collectRules, loadRules, resizeArea} from './options-rules.js';

const ValueTransform = {
  // params: (value, element)
  render: {
    showStatus: v => v !== false,
    statusStyle: (v, el) => {
      const defaultValue = DEFAULTS[el._data.name];
      el.placeholder = defaultValue;
      el.closest('details').open |= Boolean(v);
      el.addEventListener('focusin', resizeArea);
      el.addEventListener('focusout', resizeArea);
      el.addEventListener('input', resizeArea);
      return v || defaultValue;
    },
    statusStyleError: (...args) => ValueTransform.render.statusStyle(...args),
    $array: (v, el) => {
      // set rows if first time init
      if (el._data.savedValue === undefined)
        el.rows = Math.max(2, Math.min(20, arrayOrDummy(v).length + 1));
      return arrayOrDummy(v).join('\n').trim();
    },
    $boolean: v => v === true,
    $any: (v, el) => String(v !== undefined ? v : DEFAULTS[el._data.name]),
  },
  // params: (element)
  parse: {
    rules: () => collectRules(),
    $array: el => el.value.trim().split(/\s+/),
    $boolean: el => el.checked,
    $number: el => el.valueAsNumber || DEFAULTS[el._data.name],
    $string: el => el.value !== DEFAULTS[el._data.name] ? el.value : '',
  },
  find: (transforms, name, defaultValue) =>
    transforms[name] ||
    transforms[`$${Array.isArray(defaultValue) ? 'array' : typeof defaultValue}`] ||
    transforms.$any,
};

const changedElements = new Set();

loadSettings().then(settings => {
  renderSettings(settings);
  loadRules(settings.rules);

  $('#btnSave').onclick = save;
  $('#btnUpdate').onclick = update;
  $('#backup').oninput = ({target: el}) => ($('#importWrapper').disabled = !el.value.trim());
  addEventListener('input', onChange, {passive: true});
  addEventListener('change', onChange, {passive: true});

  Promise.all([
    dbExec.count(),
    dbExec({store: 'data'}).get('cacheDate'),
  ]).then(res => renderSiteinfoStats(...res));
});

function renderSettings(ss, {force} = {}) {
  for (const [k, defaultValue] of Object.entries(DEFAULTS)) {
    const el = document.getElementById(k);
    if (!el)
      continue;
    const firstInit = !el._data;
    // el._data.name is used when transforming so it should be defined beforehand
    if (firstInit)
      el._data = {name: k};
    const v = ss[k] !== undefined ? ss[k] : defaultValue;
    const renderedValue = ValueTransform.find(ValueTransform.render, k, defaultValue)(v, el);
    if (firstInit || force)
      el[el.type === 'checkbox' ? 'checked' : 'value'] = renderedValue;
    el._data.savedValue = renderedValue;
  }
}

function renderSiteinfoStats(numRules, date) {
  $('#size').textContent = numRules;
  if (!+date) date = '';
  const elDate = $('#date');
  elDate.dateTime = date;
  elDate.textContent = date ? renderDate(date) : 'N/A';
  elDate.title = date && date.toLocaleString();
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
  const ss = collectSettings();
  inBG.writeSettings(ss);
  renderSettings(ss);
  changedElements.forEach(el => el.classList.remove('changed'));
  changedElements.clear();
  for (const el of $$('#rules .deleted'))
    el._data.savedValue = !el._data.savedValue;

  $('#btnSaveWrapper').hidden = true;
}

async function update() {
  const btn = $('#btnUpdate');
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
  const ss = {};
  for (const [k, defaultValue] of Object.entries(DEFAULTS)) {
    const el = document.getElementById(k);
    if (el)
      ss[k] = ValueTransform.find(ValueTransform.parse, k, defaultValue)(el);
  }
  return ss;
}

function onChange({target: el}) {
  if (el.closest('.ignore-changes'))
    return;
  const value = el[el.type === 'checkbox' ? 'checked' : 'value'];
  const changed = value !== el._data.savedValue;
  if (changed)
    changedElements.add(el);
  else
    changedElements.delete(el);
  if (changed !== el.classList.contains('changed'))
    el.classList.toggle('changed', changed);
  const unsalvageable = !changedElements.size || (el.checkValidity && !el.checkValidity());
  const btn = $('#btnSaveWrapper');
  if (btn.hidden !== unsalvageable)
    btn.hidden = unsalvageable;
}
