export const offscreen = new Proxy({}, {
  get: (_, cmd) => exec.bind(null, cmd),
});

/** @type {{[id: string]: PromiseWithResolvers & {stack: string}}} */
let queue;
/** @type {MessagePort} */
let port;

async function exec(cmd, ...args) {
  if (!port)
    await init();
  const pr = Promise.withResolvers();
  const id = performance.now();
  pr.stack = new Error().stack;
  queue[id] = pr;
  port.postMessage({cmd, args, id});
  return pr.promise;
}

async function init() {
  let client;
  for (let retry = 0; retry < 2; retry++) {
    const url = chrome.runtime.getURL('/bg/offscreen.html');
    client = (await self.clients.matchAll({includeUncontrolled: true})).find(c => c.url === url);
    if (client || retry)
      break;
    try {
      await chrome.offscreen.createDocument({
        url,
        reasons: ['LOCAL_STORAGE'],
        justification: 'Yes',
      });
    } catch (err) {
      if (!err.message.startsWith('Only a single offscreen'))
        throw err;
    }
  }
  const mc = new MessageChannel();
  const pr = Promise.withResolvers();
  client.postMessage(null, [mc.port2]);
  port = mc.port1;
  port.onmessage = pr.resolve;
  await pr.promise;
  port.onmessage = onmessage;
  queue = {'-1': {reject: done}};
}

/** @param {MessageEvent} _ */
function onmessage({data: {id, res, err}}) {
  const v = queue[id];
  delete queue[id];
  if (!err) v.resolve(res);
  else {
    if (v.stack) err.stack += '\n' + v.stack;
    v.reject(err);
  }
}

function done(err) {
  chrome.offscreen.closeDocument();
  for (const v of Object.values(queue))
    v.reject((err.stack = v.stack, err));
  port = queue = null;
}
