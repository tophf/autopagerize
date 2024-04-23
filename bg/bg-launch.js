import {DEFAULTS, delay, getActiveTab, RETRY_TIMEOUT, tabSend} from '/util/common.js';
import {PROPS_TO_NOTIFY} from './bg-util.js';
import {g} from './bg.js';

/**
 * @return {Promise<?boolean>}
 * true if there's an applicable rule (used by lastTry='genericRules' mode)
 */
export async function launch(tabId, rules, {lastTry, first}) {
  let rr;
  while (true) {
    await delay(g.cfg.requestInterval);
    if (!await tabSend(tabId, ['ping'])) {
      // no deps while retrying means the tab got navigated away
      // and already being handled in another event
      if (lastTry === 'setTimeout')
        return;
      await execScript(tabId, 'xpather.js');
    }
    rr = await tabSend(tabId, ['checkRules', rules, !lastTry && RETRY_TIMEOUT * 1.5]) || {};
    if (rr.hasRule || lastTry)
      break;
    lastTry = 'setTimeout';
  }

  if (!rr.hasRule || lastTry === 'genericRules')
    return rr.hasRule;

  if (!rr.hasRun)
    await execScript(tabId, 'pager.js');
  const ss = {};
  for (const name of PROPS_TO_NOTIFY)
    ss[name] = g.cfg[name] ?? DEFAULTS[name];
  await tabSend(tabId, ['launch', ss, first]);
}

async function execScript(tabId, name) {
  try {
    const [{result}] = await chrome.scripting.executeScript({
      target: {tabId: tabId ?? (await getActiveTab()).id},
      files: ['/content/' + name],
    });
    return result;
  } catch (err) {}
}
