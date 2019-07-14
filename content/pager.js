/* global xpather */
'use strict';

// IIFE simplifies complete unregistering for garbage collection
(() => {
  const app = {
    /** @type Object */
    rule: null,
    /** @type Node */
    insertPoint: null,
    /** @type Number */
    pageNum: 0,
    /** @type Number */
    remainHeight: 0,
    /** @type Number */
    requestTime: 0,
    /** @type String */
    requestURL: '',
    /** @type String */
    lastRequestURL: '',
    /** @type Set<String> */
    loadedURLs: new Set(),
    /** @type function(status) */
    onPageProcessed: null,
    /** @type Number */
    pagesRemaining: 0,
    /** @type Number */
    requestInterval: 2000,
    /** @type Number */
    pageHeightThreshold: 400,
    /** @type string */
    orphanMessageId: '',
  };

  const status = {
    /** @type Boolean */
    enabled: null,
    /** @type HTMLFrameElement */
    element: null,
    /** @type Number */
    timer: 0,
    /** @type String */
    style: '',
    /** @type String */
    styleError: '',
  };

  const filters = new Map();

  window.run = cfg => {
    if (cfg.settings)
      loadSettings(cfg.settings);
    if (cfg.filter)
      filters.set(cfg.filterName, cfg.filter);
    if (cfg.rules && !maybeInit(cfg.rules, cfg.matchedRule))
      setTimeout(maybeInit, 2000, cfg.rules);
    if (cfg.loadMore)
      return doLoadMore(cfg.loadMore);
    if (cfg.terminate)
      terminate();
  };

  document.dispatchEvent(new Event('GM_AutoPagerizeLoaded', {bubbles: true}));

  function maybeInit(rules, rule) {
    if (app.loadedURLs.has(location.href))
      return true;
    if (!rule)
      rule = xpather.getMatchingRule(rules);
    if (rule) {
      init(rule);
      return true;
    }
  }

  function init(rule) {
    app.pageNum = 1;
    app.rule = rule;
    app.requestURL = getNextURL(rule.nextLink, document, location.href);
    if (!app.requestURL)
      return;

    if (rule.insertBefore)
      app.insertPoint = xpather.getFirstElement(rule.insertBefore);
    if (!app.insertPoint) {
      const page = xpather.getElements(rule.pageElement).pop();
      if (!page)
        return;

      if (!page.nextSibling)
        page.parentNode.append(' ');
      app.insertPoint = page.nextSibling;
    }

    app.loadedURLs.clear();
    app.loadedURLs.add(location.href);

    addScrollListener();
    addEventListener(app.orphanMessageId, terminate);
    chrome.runtime.sendMessage({action: 'launched'});

    const {scrollHeight} = document.scrollingElement;
    let bottom = app.insertPoint.tagName
      ? app.insertPoint.getBoundingClientRect().top
      : getBottom(app.insertPoint.previousElementSibling || app.insertPoint.parentNode);
    if (!bottom) {
      try {
        bottom = Math.max(...xpather.getElements(rule.pageElement).map(getBottom));
      } catch (e) {}
    }
    if (!bottom)
      bottom = Math.round(scrollHeight * 0.8);
    app.remainHeight = scrollHeight - bottom + app.pageHeightThreshold;
    app.requestTime = Date.now();

    onScroll();
  }

  function request({force} = {}) {
    const url = app.requestURL;
    if (!url || url === app.lastRequestURL || app.loadedURLs.has(url))
      return;
    if (!url.startsWith(location.origin + '/')) {
      statusShow({error: chrome.i18n.getMessage('errorOrigin')});
      return;
    }
    if (!force && Date.now() - app.requestTime < app.requestInterval) {
      setTimeout(onScroll, app.requestInterval);
      return;
    }
    app.requestTime = Date.now();
    app.lastRequestURL = url;
    statusShow({loading: true});

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'document';
    xhr.timeout = 60e3;
    xhr.onload = e => {
      const ok = addPage(e);
      if (app.onPageProcessed)
        app.onPageProcessed(ok);
    };
    xhr.onerror = xhr.ontimeout = e => {
      statusShow({error: e.message || e});
      if (app.onPageProcessed)
        app.onPageProcessed(false);
    };
    xhr.send();
    return true;
  }

  /**
   * @return boolean - true if there are more pages
   */
  function addPage(event) {
    const url = app.requestURL;
    const doc = event.target.response;

    // SHOULD PRECEDE stripping of stripts since a filter may need to process one
    filters.forEach(f => f(doc, url));

    for (const el of doc.getElementsByTagName('script'))
      el.remove();

    let pages, nextUrl;
    try {
      pages = xpather.getElements(app.rule.pageElement, doc);
      nextUrl = getNextURL(app.rule.nextLink, doc, url);
    } catch (e) {
      statusShow({error: chrome.i18n.getMessage('errorExtractInfo')});
      return;
    }
    if (!pages || !pages.length) {
      terminate();
      return;
    }

    if (app.insertPoint.ownerDocument !== document) {
      const lastPage = xpather.getElements(app.rule.pageElement).pop();
      if (lastPage) {
        app.insertPoint =
          lastPage.nextSibling ||
          lastPage.parentNode.appendChild(document.createTextNode(' '));
      }
    }

    const parent = app.insertPoint.parentNode;
    const bin = document.createDocumentFragment();
    const p = $create('p', {className: 'autopagerize_page_info'}, [
      chrome.i18n.getMessage('page') + ' ',
      $create('a', {
        href: url,
        className: 'autopagerize_link',
        textContent: ++app.pageNum,
      }),
    ]);

    if (pages[0].tagName !== 'TR') {
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

    pages.forEach(p => bin.appendChild(p));
    parent.insertBefore(bin, app.insertPoint);

    app.loadedURLs.add(url);
    app.requestURL = nextUrl;

    statusShow({loading: false});
    onScroll();

    document.dispatchEvent(new Event('GM_AutoPagerizeNextPageLoaded', {bubbles: true}));

    if (nextUrl)
      return true;

    terminate();
  }

  function onScroll() {
    const {scrollHeight} = document.scrollingElement;
    const remain = scrollHeight - window.innerHeight - window.scrollY;
    if (remain < app.remainHeight)
      request();
  }

  function terminate(e = {}) {
    delete window.run;
    delete window.xpather;
    removeScrollListener();
    removeEventListener(app.orphanMessageId, terminate);
    statusRemove(1500);
    if (e.type === app.orphanMessageId)
      dispatchEvent(new Event(app.orphanMessageId + ':terminated'));
  }

  function doLoadMore(num) {
    if (num === 'query')
      return app.pagesRemaining;
    app.pagesRemaining = --num || 0;
    if (num >= 0 && request({force: true})) {
      removeScrollListener();
      app.onPageProcessed = ok => {
        if (ok)
          doLoadMore.timer = setTimeout(doLoadMore, app.requestInterval, num);
        chrome.runtime.connect({name: 'pagesRemaining:' + num});
      };
    } else {
      addScrollListener();
      clearTimeout(doLoadMore.timer);
      app.onPageProcessed = null;
    }
  }

  function getNextURL(xpath, doc, url) {
    const next = xpather.getFirstElement(xpath, doc);
    if (next) {
      if (doc !== document && !doc.querySelector('base[href]'))
        doc.head.appendChild(doc.createElement('base')).href = url;
      if (!next.getAttribute('href'))
        next.setAttribute('href', next.getAttribute('action') || next.value);
      return next.href;
    }
  }

  function getBottom(el) {
    return el.getBoundingClientRect().bottom;
  }

  function getStatusStyle(css = status.style) {
    // strip all '!important', collapse ;; into ; and ensure ; at the end
    return (css.replace(/[;\s]+$|!important/g, '').replace(/;{2,}/g, ';') + ';')
      .replace(/;/g, '!important;');
  }

  function statusCreate() {
    if (status.element && document.contains(status.element))
      return;
    status.element = Object.assign(document.createElement('div'), {
      id: 'autopagerize_message_bar',
      style: getStatusStyle() + 'display: none !important',
      textContent: chrome.i18n.getMessage('loading') + '...',
    });
    document.body.appendChild(status.element);
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

  function statusShow({loading, error}) {
    let show;

    if (loading !== undefined) {
      show = loading && status.enabled;
      if (show)
        statusCreate();
      else if (!status.enabled)
        return;
      status.element.style = getStatusStyle();

    } else if (error !== undefined) {
      show = true;
      statusCreate();
      statusRemove(3000);
      status.element.style = getStatusStyle(status.styleError);
      status.element.textContent = `${chrome.i18n.getMessage('error')}: ${error}`;
      removeScrollListener();

    } else
      return;

    status.element.style.setProperty('display', show ? 'block' : 'none', 'important');
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

  function addScrollListener() {
    window.addEventListener('scroll', onScroll, {passive: true});
  }

  function removeScrollListener() {
    window.removeEventListener('scroll', onScroll);
  }

  function loadSettings(ss) {
    app.requestInterval = ss.requestInterval * 1000 || app.requestInterval;
    status.enabled = ss.showStatus !== false;
    if (ss.orphanMessageId) {
      app.orphanMessageId = ss.orphanMessageId;
      dispatchEvent(new Event(app.orphanMessageId));
    }
    if (ss.pageHeightThreshold)
      app.pageHeightThreshold = ss.pageHeightThreshold;
    if (ss.statusStyle)
      status.style = ss.statusStyle;
    if (ss.statusStyleError)
      status.styleError = ss.statusStyleError;
  }
})();
