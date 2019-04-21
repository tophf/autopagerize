/*
global settings
global ignoreLastError
*/

export async function launch(tabId, rules, key) {
  if (!await poke(tabId).checkDeps())
    await poke(tabId, {file: '/content/xpather.js'});

  const rr = await poke(tabId).checkRule(rules, key) || {};
  if (!rr.hasRule)
    return;

  if (!rr.hasRun)
    await poke(tabId, {file: '/content/pager.js'});

  await poke(tabId).doRun({
    enabled: settings.enabled,
    display_message_bar: settings.display_message_bar,
  });
}

const CONTENT_SCRIPT_CODE = {
  checkDeps() {
    return typeof (window.xpather || {}).getMatchingRule === 'function';
  },
  checkRule(rules, urlCacheKey) {
    const r = window.xpather.getMatchingRule(rules);
    if (r.rule) {
      window.rules = rules;
      window.matchedRule = r.rule;
      return {
        hasRule: true,
        hasRun: typeof run === 'function',
      };
    } else if (!r.pageElementFound) {
      // assuming it's a non-pagerizable URL
      delete window.xpather;
      chrome.storage.local.set({[urlCacheKey]: ''});
    }
  },
  doRun(settings) {
    window.run(window.rules, window.matchedRule, settings);
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
