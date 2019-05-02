/** @type chrome.tabs.Tab */
export let tab;

Promise.all([
  getActiveTab(),
  onDomLoaded(),
]).then(([
  tab_,
]) => {
  tab = tab_;
  $.status.checked = isGloballyEnabled();
  $.status.onchange = toggled;
  $.hotkeys.onclick = e => {
    chrome.tabs.create({url: $.hotkeys.href});
    e.preventDefault();
  };
  $.openOptions.onclick = e => {
    chrome.runtime.openOptionsPage();
    e.preventDefault();
  };
  renderStatus();
  import('./popup-load-more.js');
  import('./popup-exclude.js');
});

function renderStatus() {
  const enabled = $.status.checked;
  $.status.closest('[data-status]').dataset.status = enabled;
  $.statusText.textContent = i18n(enabled ? 'on' : 'off');
}

function toggled() {
  inBG.switchGlobalState($.status.checked);
  renderStatus();
}

function getActiveTab() {
  return new Promise(resolve =>
    chrome.tabs.query({active: true, currentWindow: true}, tabs =>
      resolve(tabs[0])));
}
