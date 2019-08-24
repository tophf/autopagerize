import {execScript} from '/util/common.js';
import {$, $$} from '/util/dom.js';
import {i18n} from '/util/locale.js';
import * as popup from './popup.js';

$('#loadStop').onclick = stop;
for (const el of $$('#loadMoreSection a'))
  el.onclick = run;

inTab('query').then(num => {
  if (num > 0) {
    renderState(true);
    $('#loadMoreSection details').open = true;
    chrome.runtime.onConnect.addListener(onConnect);
  }
});

function run(e) {
  e.preventDefault();
  e.target.classList.add('done');
  $('#loadRemain').textContent = '';
  renderState(true);
  inTab(Number(e.target.textContent));
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
  for (const el of $$('#loadMoreSection .done'))
    el.classList.remove('done');
}

function inTab(data) {
  return execScript(
    popup.tab.id || null,
    data => typeof run === 'function' && window.run({loadMore: data}),
    data);
}

/** @param {chrome.runtime.Port} port */
function onConnect(port) {
  const {name, sender} = port;
  let [action, num] = String(name).split(':', 2);
  if (action === 'pagesRemaining' &&
      sender && sender.tab && sender.tab.id === popup.tab.id) {
    port.disconnect();
    num = Number(num);
    $('#loadRemain').textContent = num ? num + '...' : i18n('done');
    if (!num)
      stop();
  }
}

function renderState(running) {
  $('#loadMoreSection').classList.toggle('disabled', running);
}
