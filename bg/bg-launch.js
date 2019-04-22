/*
global idb
global settings
global ignoreLastError
*/

export async function launch(tabId, rules, key, {lastTry} = {}) {
  if (!await poke(tabId).checkDeps()) {
    // no deps while retrying means the tab got navigated away
    // and already being handled in another event
    if (lastTry === 'setTimeout')
      return;
    await poke(tabId, {file: '/content/xpather.js'});
  }

  const rr = await poke(tabId).checkRules(rules) || {};
  if (!rr.hasRule && !lastTry)
    await new Promise(r => setTimeout(retry, 2000, r, [...arguments]));
  if (!rr.hasRule)
    return;

  if (!rr.hasRun)
    await poke(tabId, {file: '/content/pager.js'});

  await poke(tabId).doRun({
    enabled: settings.enabled,
    display_message_bar: settings.display_message_bar,
  });
}

function retry(resolve, args) {
  args[args.length - 1] = {lastTry: 'setTimeout'};
  launch(...args).then(resolve);
}

const CONTENT_SCRIPT_CODE = {
  checkDeps() {
    return typeof (window.xpather || {}).getMatchingRule === 'function';
  },
  checkRules(rules) {
    const r = window.xpather.getMatchingRule(rules);
    if (r) {
      window.rules = rules;
      window.matchedRule = r;
      return {
        hasRule: true,
        hasRun: typeof run === 'function',
      };
    } else {
      delete window.xpather;
    }
  },
  doRun(settings) {
    // eslint-disable-next-line no-undef
    window.run({rules, matchedRule, settings});
    delete window.rules;
    delete window.matchedRule;
  },
};

function poke(tabId, exec) {
  if (exec)
    return executeScript(tabId, exec);
  else
    return new Proxy({}, {
      get(_, name) {
        return (...params) => {
          const paramsStr = JSON.stringify(params).slice(1, -1);
          return executeScript(tabId, {
            code: `(function ${CONTENT_SCRIPT_CODE[name]})(${paramsStr})`,
          });
        };
      },
    });
}

function executeScript(tabId, options) {
  return new Promise(resolve => {
    chrome.tabs.executeScript(tabId, options, results => {
      ignoreLastError();
      resolve(results && results[0]);
    });
  });
}
