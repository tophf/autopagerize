export {
  launch,
};

import {DEFAULTS, PROPS_TO_NOTIFY, RETRY_TIMEOUT, execScript} from '/util/common.js';
import {settings} from './bg.js';

let fixes;

/**
 * @return {Promise<?boolean>}
 * true if there's an applicable rule (used by lastTry='genericRules' mode)
 */
async function launch({tabId, url, rules, lastTry}) {
  let rr;
  while (true) {
    await new Promise(r => setTimeout(r, RETRY_TIMEOUT));
    if (!await execScript(tabId, contentCheckDeps)) {
      // no deps while retrying means the tab got navigated away
      // and already being handled in another event
      if (lastTry === 'setTimeout')
        return;
      await execScript(tabId, {file: '/content/xpather.js'});
    }
    rr = await execScript(tabId, contentCheckRules, rules, !lastTry && RETRY_TIMEOUT) || {};
    if (rr.hasRule || lastTry)
      break;
    lastTry = 'setTimeout';
  }

  if (!rr.hasRule || lastTry === 'genericRules')
    return rr.hasRule;

  if (!rr.hasRun)
    await execScript(tabId, {file: '/content/pager.js'});

  for (const f of fixes || parseFixes())
    if (f.filters.every(f => url[f[0]](f[1])))
      await execScript(tabId, {file: f.file});

  const ss = {orphanMessageId: localStorage.orphanMessageId};
  for (const name of PROPS_TO_NOTIFY) {
    const v = settings()[name];
    const def = DEFAULTS[name];
    ss[name] = typeof def === 'string' ? v || def : v;
  }
  await execScript(tabId, contentDoRun, ss);
}

function contentCheckDeps() {
  return typeof (window.xpather || {}).getMatchingRule === 'function';
}

function contentCheckRules(rules, retryTimeout) {
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
}

function contentDoRun(settings) {
  // eslint-disable-next-line no-undef
  run({rules, matchedRule, settings});
  window.launched = true;
  delete window.rules;
  delete window.matchedRule;
}

function parseFixes() {
  try {
    fixes = JSON.parse(localStorage.fixes);
    for (const {filters: flt} of fixes) {
      for (let i = 0, f, val; (f = flt[i]); i++) {
        if (f[0] === 'match' && typeof (val = f[1]) === 'string') {
          try {
            val = new RegExp(val.slice(1, -1));
          } catch (e) {
            val = /^$/;
            console.error(e);
          }
          f[1] = val;
        }
      }
    }
  } catch (e) {
    fixes = [];
  }
  return fixes;
}
