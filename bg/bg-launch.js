import {DEFAULTS, doDelay, getActiveTab, RETRY_TIMEOUT, tabSend} from '/util/common.js';
import {PROPS_TO_NOTIFY} from './bg-util.js';
import {g} from './bg.js';

/**
 * @return {Promise<?boolean>}
 * true if there's an applicable rule (used by lastTry='genericRules' mode)
 */
export async function launch(tabId, rules, {lastTry, first}) {
  let rr;
  let delay = g.cfg.requestInterval;
  if (first)
    await execScript(tabId, 'xpather.js');
  while (!(
    await doDelay(delay),
    rr = await tabSend(tabId, ['checkRules', rules])
  )) {
    if (rr === undefined) // navigated to another doc
      return;
    if (lastTry)
      break;
    lastTry = true;
    delay = RETRY_TIMEOUT;
  }
  if (!rr || lastTry === 'genericRules')
    return rr;
  if (!rr?.run)
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
