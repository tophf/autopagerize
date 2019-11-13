import {arrayOrDummy, DEFAULTS, inBG} from '/util/common.js';
import {$} from '/util/dom.js';
import {loadRules} from './options-rules.js';
import {collectSettings, renderSettings} from './options.js';

$('#btnImport').onclick = importSettings;
$('#btnExport').onclick = exportSettings;
$('#importExportTitle').onclick = e =>
  setTimeout(() => e.target.parentElement.scrollIntoView({behavior: 'smooth'}));

async function importSettings() {
  let imported;
  const elError = $('#importError');
  try {
    imported = JSON.parse($('#backup').value);
    elError.hidden = true;
  } catch (e) {
    elError.textContent = String(e);
    elError.hidden = false;
    return;
  }
  const ovr = $('#overwriteSettings').checked;
  const settings = ovr ? {...DEFAULTS} : collectSettings();
  for (const [k, ref] of Object.entries(DEFAULTS)) {
    const v = imported[k];
    if (v === undefined) {
      if (ovr)
        settings[k] = Array.isArray(ref) ? [...ref] : ref;
      continue;
    }
    settings[k] =
      ref === true || ref === false ? Boolean(v) :
        typeof ref === 'string' ? String(v || '') :
          typeof ref === 'number' ? isNaN(v) ? ref : +v :
            Array.isArray(ref) ? deduplicate(settings, k, v) :
              v;
  }
  await inBG.writeSettings(settings);
  $('#rules').textContent = '';
  loadRules(settings.rules);
  renderSettings(settings, {force: true});
}

function exportSettings() {
  const elBackup = $('#backup');
  elBackup.focus();
  elBackup.value = JSON.stringify(collectSettings(), null, '  ');
  elBackup.select();
  document.execCommand('copy');
  $('#importError').hidden = true;
}

function deduplicate(settings, k, v) {
  return [...new Set([...settings[k], ...arrayOrDummy(v)])];
}
