export {
  observeNavigation,
};

if (isGloballyEnabled())
  observeNavigation();

chrome.contextMenus.create({
  id: 'onOff',
  type: 'checkbox',
  contexts: ['page_action', 'browser_action'],
  title: chrome.i18n.getMessage('onOff'),
  checked: isGloballyEnabled(),
}, ignoreLastError);

chrome.contextMenus.onClicked.addListener(info => {
  endpoints().switchGlobalState(info.checked);
});

chrome.commands.onCommand.addListener(cmd => {
  if (cmd === 'onOff') {
    endpoints().switchGlobalState(!isGloballyEnabled());
    return;
  }
  if (cmd.startsWith('loadMore')) {
    chrome.tabs.executeScript({
      code: `
        typeof run === 'function' &&
        run({loadMore: ${cmd.slice(-2)}})
      `,
    }, ignoreLastError);
    return;
  }
});

chrome.runtime.onMessage.addListener(self.onRuntimeMessage);

function observeNavigation() {
  const filter = {url: [{schemes: ['http', 'https']}]};
  chrome.webNavigation.onCompleted.addListener(self.maybeProcessMain, filter);
  chrome.webNavigation.onHistoryStateUpdated.addListener(self.maybeProcess, filter);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(self.maybeProcess, filter);
}

function endpoints() {
  return self.endpoints || self.initMessaging();
}
