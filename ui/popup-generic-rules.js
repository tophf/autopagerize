import {getSettings, ignoreLastError, RETRY_TIMEOUT} from '/util/common.js';
import {$} from '/util/dom.js';
import {applyPerSite, updateSpecificity} from './popup-exclude.js';
import * as popup from './popup.js';

$.genericRulesSection.hidden = false;
$.genericRulesSection.addEventListener('click', async () => {
  if ((await getSettings()).genericRulesEnabled) {
    $.genericRulesSection.removeAttribute('disabled');
    if (!$.specificity.dataset.ready)
      updateSpecificity();
    $.grSlot.replaceWith(Object.assign($.specificity.cloneNode(true), {
      id: '',
      async onclick(e) {
        e.preventDefault();
        const tabId = popup.tab.id;
        await applyPerSite(e.target.title, 'genericSites');
        chrome.tabs.reload(tabId, ignoreLastError);
        await waitForTabLoad(popup.tab);
        await new Promise(resolve => setTimeout(resolve, RETRY_TIMEOUT));
        location.search = '';
      },
    }));
  }
}, {once: true});

function waitForTabLoad(tab) {
  new Promise(resolve => {
    chrome.tabs.onUpdated.addListener(function _(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(_);
        resolve();
      }
    });
  });
}
