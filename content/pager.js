'use strict';

// IIFE simplifies complete unregistering for garbage collection
(() => {
  const status = {
    /** @type {Boolean} */
    enabled: null,
    /** @type {HTMLFrameElement} */
    element: null,
    /** @type {Number} */
    timer: 0,
    /** @type {String} */
    style: '',
    /** @type {String} */
    styleError: '',
  };
  const filters = new Set();
  const orphanMessageId = chrome.runtime.id;
  /** @type {Node|HTMLElement} */
  let insertPoint;
  let lastRequestURL = '';
  /** @type {Record<String>} */
  let loadedURLs = {};
  /** @type {function(status)} */
  let onPageProcessed;
  let pageNum = 0;
  let pagesRemaining = 0;
  let requestInterval = 2000;
  let requestTime = 0;
  let requestTimer = 0;
  let requestURL = '';
  /** @type {Object} */
  let rule;
  /** @type {IntersectionObserver} */
  let xo;
  /** @type {?Element} */
  let xoElem;

  window.run = cfg => {
    let v;
    if ((v = cfg.settings))
      loadSettings(v);
    if ((v = cfg.filter))
      filters.add(v);
    if ((v = cfg.launch) && (loadedURLs = {}, !maybeInit(...v)))
      setTimeout(maybeInit, requestInterval, v[0]);
    if ((v = cfg.loadMore))
      return doLoadMore(v);
    if (cfg.terminate)
      terminate();
  };

  document.dispatchEvent(new Event('GM_AutoPagerizeLoaded', {bubbles: true}));

  function maybeInit(rules, rule) {
    // content scripts may get unloaded during setTimeout
    if (!self.xpather?.MICROFORMAT)
      return terminate();
    if (loadedURLs[location.href])
      return true;
    if (!rule)
      rule = xpather.getMatchingRule(rules);
    if (rule) {
      init(rule);
      return true;
    }
  }

  function init(matchedRule) {
    pageNum = 1;
    rule = matchedRule;
    requestURL = getNextURL(rule.nextLink, document, location.href);
    if (!requestURL)
      return;
    let el = rule.insertBefore;
    if (!(insertPoint = el && xpather.getFirst(el))) {
      el = xpather.getLast(rule.pageElement);
      if (!el) return;
      insertPoint = ensureNextSibling(el);
    }
    loadedURLs = {[location.href]: 1};
    requestTime = performance.now();
    addEventListener(orphanMessageId, terminate);
    chrome.runtime.sendMessage({action: 'launched'});
    watchBottom();
  }

  function ensureNextSibling(el) {
    return el.nextSibling || (el.after(' '), el.nextSibling);
  }

  function request({force, timer} = {}) {
    if (timer)
      requestTimer = 0;
    else if (requestTimer)
      return;
    const url = requestURL;
    if (!url || url === lastRequestURL || loadedURLs[url])
      return;
    if (!url.startsWith(location.origin + '/')) {
      statusShow({error: chrome.i18n.getMessage('errorOrigin')});
      return;
    }
    const remain = requestInterval - (performance.now() - requestTime);
    if (!force && remain > 0) {
      requestTimer = setTimeout(request, remain, {timer: true});
      return;
    }
    requestTime = performance.now();
    lastRequestURL = url;
    statusShow({loading: true});

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'document';
    xhr.timeout = 60e3;
    xhr.onload = e => {
      const ok = addPage(e, force);
      onPageProcessed?.(ok);
    };
    xhr.onerror = xhr.ontimeout = e => {
      statusShow({error: e.message || e});
      onPageProcessed?.(false);
    };
    xhr.send();
    return true;
  }

  /**
   * @return boolean - true if there are more pages
   */
  function addPage(event) {
    const url = requestURL;
    const doc = event.target.response;
    // SHOULD PRECEDE stripping of scripts since a filter may need to process one
    for (const f of filters) f(doc, url);
    let elems, nextUrl;
    document.dispatchEvent(new MouseEvent('GM_AutoPagerizeNextPageDoc', {
      bubbles: true,
      relatedTarget: doc,
    }));
    try {
      for (const el of doc.getElementsByTagName('script'))
        el.remove();
      elems = xpather.getElements(rule.pageElement, doc);
      nextUrl = getNextURL(rule.nextLink, doc, url);
    } catch (e) {
      statusShow({error: chrome.i18n.getMessage('errorExtractInfo')});
      return;
    }
    if (elems.length)
      addPageElements(url, elems);
    loadedURLs[url] = 1;
    requestURL = nextUrl;
    statusShow({loading: false});
    document.dispatchEvent(new Event('GM_AutoPagerizeNextPageLoaded', {bubbles: true}));
    if (!nextUrl) {
      terminate();
    } else {
      return true;
    }
  }

  function addPageElements(url, elems) {
    if (insertPoint.ownerDocument !== document) {
      const el = xpather.getLast(rule.pageElement);
      if (el) insertPoint = ensureNextSibling(el);
    }
    const parent = insertPoint.parentNode;
    const bin = document.createDocumentFragment();
    const p = $create('p', {className: 'autopagerize_page_info'}, [
      chrome.i18n.getMessage('page') + ' ',
      $create('a', {
        href: url,
        className: 'autopagerize_link',
        textContent: ++pageNum,
      }),
    ]);
    if (elems[0].tagName !== 'TR') {
      bin.appendChild($create('hr', {className: 'autopagerize_page_separator'}));
      bin.appendChild(p);
    } else {
      let cols = 0;
      for (const sibling of parent.children)
        if (sibling.tagName === 'TD' || sibling.tagName === 'TH')
          cols += sibling.colSpan || 1;
      bin.appendChild(
        $create('tr', {},
          $create('td', {colSpan: cols},
            p)));
    }
    elems.forEach(bin.appendChild, bin);
    parent.insertBefore(bin, insertPoint);
    watchBottom();
  }

  function watchBottom() {
    xo.disconnect();
    xoElem = insertPoint.tagName ? insertPoint
      : insertPoint.previousElementSibling || insertPoint.parentNode;
    xo.observe(xoElem);
  }

  /** @param {IntersectionObserverEntry} e */
  function onIntersect([e]) {
    if (e.isIntersecting) {
      xo.disconnect();
      xoElem = null;
      request();
    }
  }

  function terminate(e) {
    if (e && chrome.runtime.id)
      return;
    chrome.runtime.onMessage.removeListener(xpather.onmessage);
    removeEventListener(orphanMessageId, terminate);
    delete window.run;
    delete window.xpather;
    xo.disconnect();
    xo = xoElem = null;
    statusRemove(1500);
    if (e)
      dispatchEvent(new Event(orphanMessageId + ':terminated'));
  }

  function doLoadMore(num) {
    if (num === 'query')
      return pagesRemaining;
    pagesRemaining = --num || 0;
    if (num >= 0 && request({force: true})) {
      onPageProcessed = ok => {
        if (ok)
          doLoadMore.timer = setTimeout(doLoadMore, requestInterval, num);
        chrome.runtime.connect({name: 'pagesRemaining:' + num})
          .onDisconnect.addListener(() => chrome.runtime.lastError);
      };
    } else {
      clearTimeout(doLoadMore.timer);
      onPageProcessed = null;
    }
  }

  function getNextURL(xpath, doc, url) {
    const next = xpather.getFirst(xpath, doc);
    if (next) {
      if (doc !== document && !doc.querySelector('base[href]'))
        doc.head.appendChild(doc.createElement('base')).href = url;
      if (!next.getAttribute('href'))
        next.setAttribute('href', next.getAttribute('action') || next.value);
      return next.href;
    }
  }

  function getStatusStyle(css = status.style) {
    // strip all '!important', collapse ;; into ; and ensure ; at the end
    return (css.replace(/[;\s]+$|!important/g, '').replace(/;{2,}/g, ';') + ';')
      .replace(/;/g, '!important;');
  }

  function statusCreate() {
    if (status.element && document.contains(status.element))
      return;
    const el = status.element = document.createElement('div');
    el.id = 'autopagerize_message_bar';
    el.textContent = chrome.i18n.getMessage('loading') + '...';
    statusSetStyle('display: none');
    document.body.appendChild(el);
  }

  function statusRemove(timeout) {
    clearTimeout(status.timer);
    if (timeout)
      status.timer = setTimeout(statusRemove, timeout);
    else if (status.element) {
      status.element.remove();
      status.element = null;
    }
  }

  function statusSetStyle(extra = '', main = getStatusStyle()) {
    status.element.style.cssText = main + extra.replace(/;/g, '!important;');
  }

  function statusShow({loading, error}) {
    let show;
    let style;
    if (loading !== undefined) {
      show = loading && status.enabled;
      if (show)
        statusCreate();
      else if (!status.enabled)
        return;
      style = getStatusStyle();

    } else if (error !== undefined) {
      show = true;
      statusCreate();
      statusRemove(3000);
      style = getStatusStyle(status.styleError);
      status.element.textContent = `${chrome.i18n.getMessage('error')}: ${error}`;

    } else
      return;

    statusSetStyle(`opacity:0; ${show ? 'display:block' : ''}`, style);
    setTimeout(statusSetStyle,
      show ? 0 : parseFloat(status.element.style.transitionDuration) * 1000 || 0,
      `display: ${show ? 'block' : 'none'}`);
  }

  function $create(tag, props, children) {
    const el = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    if (props)
      Object.assign(el, props);
    if (children instanceof Node)
      el.appendChild(children);
    else if (Array.isArray(children))
      el.append(...children);
    return el;
  }

  function loadSettings(ss) {
    let v;
    if ((v = ss.requestInterval * 1000))
      requestInterval = v;
    if ((v = ss.pageHeightThreshold) || !xo) {
      xo?.disconnect();
      xo = new IntersectionObserver(onIntersect, {rootMargin: v + 'px'});
      if (xoElem) xo.observe(xoElem);
    }
    status.enabled = ss.showStatus !== false;
    if ((v = ss.statusStyle))
      status.style = v;
    if ((v = ss.statusStyleError))
      status.styleError = v;
  }
})();
