/* global tab */
'use strict';

$.excludeGo.onclick = async () => {
  $.excludeSection.classList.add('disabled');
  $.excludeGo.textContent = chrome.i18n.getMessage('done');
  const ss = await getSettings();
  ss.excludes = arrayOrDummy(ss.excludes);
  if (!ss.excludes.includes($.excludeGo.title)) {
    ss.excludes.push($.excludeGo.title);
    inBG.writeSettings(ss);
  }
};

$.excludeSelector.onchange = async function () {
  const value = $.excludeSelector.value;
  const {url} = tab;
  $.excludeGo.title =
    value === 'url' ? url :
      value === 'prefix' ? url + '*' :
        value === 'domain' ? new URL(url).origin + '/*' : '';
};

$.excludeSelector.onchange();
