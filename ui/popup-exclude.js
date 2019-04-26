import * as popup from './popup.js';

updateTitle();
$.excludeGo.onclick = exclude;
$.excludeSelector.onchange = updateTitle;

async function exclude() {
  $.excludeSection.classList.add('disabled');
  $.excludeGo.textContent = i18n('done');
  const ss = await getSettings();
  ss.excludes = arrayOrDummy(ss.excludes);
  if (!ss.excludes.includes($.excludeGo.title)) {
    ss.excludes.push($.excludeGo.title);
    inBG.writeSettings(ss);
  }
}

async function updateTitle() {
  const value = $.excludeSelector.value;
  const {url} = popup.tab;
  $.excludeGo.title =
    value === 'url' ? url :
      value === 'prefix' ? url + '*' :
        value === 'domain' ? new URL(url).origin + '/*' : '';
}
