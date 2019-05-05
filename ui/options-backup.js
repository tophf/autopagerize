import {
  collectSettings,
  renderSettings,
} from './options.js';

import {
  loadRules,
} from './options-rules.js';

import {
  arrayOrDummy,
  DEFAULT_SETTINGS,
  inBG,
} from '/util/common.js';

import {$} from '/util/dom.js';

$.btnImport.onclick = importSettings;
$.btnExport.onclick = exportSettings;

async function importSettings() {
  let imported;
  try {
    imported = JSON.parse($.backup.value);
    $.importError.hidden = true;
  } catch (e) {
    $.importError.textContent = String(e);
    $.importError.hidden = false;
    return;
  }
  const ovr = $.overwriteSettings.checked;
  const settings = ovr ? DEFAULT_SETTINGS : collectSettings();
  for (const [k, ref] of Object.entries(DEFAULT_SETTINGS)) {
    const v = imported[k];
    settings[k] =
      ref === true || ref === false ? Boolean(v) :
        typeof ref === 'string' ? String(v) :
          typeof ref === 'number' ? Number(v) :
            Array.isArray(ref) ? [...settings[k], ...arrayOrDummy(v)] :
              v;
  }
  await inBG.writeSettings(settings);
  $.rules.textContent = '';
  loadRules(settings.rules);
  renderSettings(settings);
}

function exportSettings() {
  $.backup.focus();
  $.backup.select();
  document.execCommand('insertText', false, JSON.stringify(collectSettings(), null, '  '));
  $.backup.select();
  $.importError.hidden = true;
}
