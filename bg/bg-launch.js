export async function launch(tabId, rules) {
  if (!await executeScriptCode(tabId, csHasUtils))
    await executeScript(tabId, {file: 'content-utils.js'});

  const [hasRule, hasRun] = await executeScriptCode(tabId, csHasStuff, rules) || [];
  if (!hasRule)
    return;
  if (!hasRun)
    await executeScript(tabId, {file: 'content.js'});

  await executeScriptCode(tabId, csRun, {
    disable: self.settings.disable,
    display_message_bar: self.settings.display_message_bar,
  });
}

function csHasUtils() {
  return typeof (window.utils || {}).getMatchingRule === 'function';
}

function csHasStuff(rules) {
  const matchedRule = window.utils.getMatchingRule(rules);
  if (!matchedRule)
    return [];
  window.rules = rules;
  window.matchedRule = matchedRule;
  return [true, typeof window.run === 'function'];
}

function csRun(settings) {
  window.run(window.rules, window.matchedRule, settings);
  delete window.rules;
  delete window.matchedRule;
}

function executeScript(tabId, options) {
  return new Promise(resolve => {
    chrome.tabs.executeScript(tabId, options, ([result] = []) => {
      chrome.runtime.lastError; // eslint-disable-line
      resolve(result);
    });
  });
}

function executeScriptCode(tabId, fn, ...params) {
  const paramsStr = JSON.stringify(params).slice(1, -1);
  return executeScript(tabId, {code: `(${fn})(${paramsStr})`});
}
