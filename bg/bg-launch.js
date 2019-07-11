export {
  launch,
};

import {PROPS_TO_NOTIFY, execScript} from '/util/common.js';
import {settings} from './bg.js';

const RETRY_TIMEOUT = 2000;

async function launch({tabId, rules, lastTry}) {
  if (!await poke(tabId).checkDeps()) {
    // no deps while retrying means the tab got navigated away
    // and already being handled in another event
    if (lastTry === 'setTimeout')
      return;
    await poke(tabId, {file: '/content/xpather.js'});
  }

  const rr = await poke(tabId).checkRules(rules, !lastTry && RETRY_TIMEOUT) || {};
  if (!rr.hasRule && !lastTry)
    return new Promise(r => setTimeout(retry, RETRY_TIMEOUT, r, arguments[0]));
  if (!rr.hasRule)
    return;

  if (!rr.hasRun)
    await poke(tabId, {file: '/content/pager.js'});

  const ss = {orphanMessageId: localStorage.orphanMessageId};
  for (const name of PROPS_TO_NOTIFY)
    ss[name] = settings()[name];
  await poke(tabId).doRun(ss);
}

function retry(resolve, cfg) {
  launch({...cfg, lastTry: 'setTimeout'}).then(resolve);
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
    window.launched = true;
    delete window.rules;
    delete window.matchedRule;
  },
};

const POKE_HANDLER = {
  get(cfg, name) {
    return (...params) =>
      execScript(cfg.tabId, CONTENT_SCRIPT_CODE[name], ...params);
  },
};

function poke(tabId, options) {
  return options
    ? execScript(tabId, options)
    : new Proxy({tabId}, POKE_HANDLER);
}
