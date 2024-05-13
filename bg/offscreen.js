let port;
let unloadTimer;

const commands = {
  __proto__: null,
  localStorageGet(what) {
    if (typeof what === 'string')
      return localStorage[what];
    if (!what)
      return Object.assign({}, localStorage);
    if (Array.isArray(what))
      return what.reduce((res, k) => ((res[k] = localStorage[k]), res), {});
  },
  localStorageSet(obj) {
    for (const k in obj) {
      const v = obj[k];
      if (v != null) localStorage[k] = v;
      else delete localStorage[k];
    }
  },
  xhr(url, opts = {}) {
    return new Promise((resolve, reject) => {
      const {headers, portName, ...xhrOpts} = opts;
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      if (headers)
        for (const h in headers)
          xhr.setRequestHeader(h, headers[h]);
      Object.assign(xhr, xhrOpts);
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = reject;
      xhr.ontimeout = reject;
      if (portName) {
        const port = chrome.runtime.connect({name: portName});
        xhr.onprogress = e => port.postMessage(e.loaded);
        xhr.onloadend = () => port.disconnect();
      }
      xhr.send();
    });
  },
};

/** @param {MessageEvent} evt */
navigator.serviceWorker.addEventListener('message', evt => {
  port = evt.ports[0];
  port.postMessage(null);
  port.onmessage = onBGmessage;
}, {once: true});

navigator.serviceWorker.startMessages();

/** @param {MessageEvent} evt */
async function onBGmessage(evt) {
  const {data} = evt;
  let res, err;
  clearTimeout(unloadTimer);
  try {
    res = commands[data.cmd].apply(evt, data.args);
    if (res instanceof Promise) res = await res;
  } catch (e) {
    err = e;
  }
  port.postMessage({id: data.id, res, err});
  unloadTimer = setTimeout(unload, 5e3);
}

function unload() {
  port.postMessage({id: -1, err: new Error('Offscreen timeout')});
}
