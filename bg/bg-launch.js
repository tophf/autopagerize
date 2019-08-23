export {
  launch,
};

import {DEFAULTS, PROPS_TO_NOTIFY, RETRY_TIMEOUT, execScript} from '/util/common.js';
import {settings} from './bg.js';

/**
 * @return {Promise<boolean?>}
 * true if there's an applicable rule (used by lastTry='genericRules' mode)
 */
async function launch({tabId, url, rules, lastTry}) {
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
  if (!rr.hasRule || lastTry === 'genericRules')
    return rr.hasRule;

  if (!rr.hasRun)
    await poke(tabId, {file: '/content/pager.js'});

  if (url.includes('google.') &&
      /^https?:\/\/(www\.)?google(\.com?)?(\.\w\w)?\/.*?[?&#]q=[^&]+/.test(url))
    await execScript(tabId, {file: '/content/fix-google.js'});

  if (url.startsWith('https://www.youtube.com/results'))
    await execScript(tabId, {file: '/content/fix-youtube.js'});

  if (url.startsWith('https://news.search.yahoo.co'))
    await execScript(tabId, {file: '/content/fix-yahoo.js'});

  const ss = {orphanMessageId: localStorage.orphanMessageId};
  for (const name of PROPS_TO_NOTIFY) {
    const v = settings()[name];
    const def = DEFAULTS[name];
    ss[name] = typeof def === 'string' ? v || def : v;
  }
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
    if (typeof (window.xpather || {}).getMatchingRule !== 'function')
      return;
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
        if (typeof run !== 'function')
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
