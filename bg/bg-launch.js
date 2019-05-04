export {
  launch,
};

import {
  executeScript,
} from '/util/common.js';

import {
  settings,
} from './bg.js';

const RETRY_TIMEOUT = 2000;

async function launch(tabId, rules, key, lastTry) {
  if (!await poke(tabId).checkDeps()) {
    // no deps while retrying means the tab got navigated away
    // and already being handled in another event
    if (lastTry === 'setTimeout')
      return;
    await poke(tabId, {file: '/content/xpather.js'});
  }

  const rr = await poke(tabId).checkRules(rules, !lastTry && RETRY_TIMEOUT) || {};
  if (!rr.hasRule && !lastTry)
    await new Promise(r => setTimeout(retry, RETRY_TIMEOUT, r, [...arguments]));
  if (!rr.hasRule)
    return;

  if (!rr.hasRun)
    await poke(tabId, {file: '/content/pager.js'});

  await poke(tabId).doRun({
    showStatus: settings().showStatus,
    requestInterval: settings().requestInterval,
  });
}

function retry(resolve, args) {
  args[args.length - 1] = 'setTimeout';
  launch(...args).then(resolve);
}

// declare as anonymous functions for proper stringification in executeScript
const CONTENT_SCRIPT_CODE = {
  checkDeps: function () {
    return typeof (window.xpather || {}).getMatchingRule === 'function';
  },
  checkRules: function (rules, retryTimeout) {
    const r = window.xpather.getMatchingRule(rules);
    if (r) {
      clearTimeout(window.retryTimer);
      window.retryTimer = null;
      window.rules = rules;
      window.matchedRule = r;
      return {
        hasRule: true,
        hasRun: typeof run === 'function',
      };
    } else {
      window.retryTimer = setTimeout(() => {
        delete window.xpather;
      }, retryTimeout * 1.5);
    }
  },
  doRun: function (settings) {
    // eslint-disable-next-line no-undef
    window.run({rules, matchedRule, settings});
    delete window.rules;
    delete window.matchedRule;
  },
};

const POKE_HANDLER = {
  get(cfg, name) {
    return (...params) =>
      executeScript(cfg.tabId, CONTENT_SCRIPT_CODE[name], ...params);
  },
};

function poke(tabId, options) {
  return options
    ? executeScript(tabId, options)
    : new Proxy({tabId}, POKE_HANDLER);
}
