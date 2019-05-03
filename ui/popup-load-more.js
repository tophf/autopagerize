import * as popup from './popup.js';

import {
  executeScript,
} from '/util/common.js';

import {$} from '/util/dom.js';
import {i18n} from '/util/locale.js';

$.loadGo.onclick = run;
$.loadStop.onclick = stop;

query().then(num => {
  if (num > 0) {
    renderState(true);
    chrome.runtime.onConnect.addListener(onConnect);
  }
});

function run() {
  $.loadRemain.textContent = '';
  renderState(true);
  inTab($.loadNum.value);
  chrome.runtime.onConnect.addListener(onConnect);
}

/**
 * @param {Event} [event] - omit it to skip executeScript when calling explicitly
 */
function stop(event) {
  renderState(false);
  chrome.runtime.onConnect.removeListener(onConnect);
  if (event)
    inTab('stop');
}

function inTab(data) {
  executeScript(
    popup.tab.id,
    data => typeof run === 'function' && window.run({loadMore: data}),
    data);
}

function query() {
  return executeScript(null,
    () => typeof run === 'function' && window.run({loadMore: 'query'}));
}

/** @param {chrome.runtime.Port} port */
function onConnect(port) {
  const {name, sender} = port;
  let [action, num] = String(name).split(':', 2);
  if (action === 'pagesRemaining' &&
      sender && sender.tab && sender.tab.id === popup.tab.id) {
    port.disconnect();
    num = Number(num);
    $.loadRemain.textContent = num ? num + '...' : i18n('done');
    if (!num)
      stop();
  }
}

function renderState(running) {
  $.loadGo.closest('section').classList.toggle('disabled', running);
}
