/* global xpather */
'use strict';

// IIFE simplifies complete unregistering for garbage collection
(() => {
  const BASE_REMAIN_HEIGHT = 400;
  const MIN_REQUEST_INTERVAL = 2000;

  const app = {
    /** @type Boolean */
    enabled: null,
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
  };

  const status = {
    /** @type Boolean */
    enabled: null,
    /** @type HTMLFrameElement */
    element: null,
    /** @type Number */
    timer: 0,
  };

  window.run = ({rules, matchedRule, settings, loadMore}) => {
    if (settings)
      loadSettings(settings);
    if (rules && !maybeInit(rules, matchedRule))
      setTimeout(maybeInit, 2000, rules);
    if (loadMore)
      doLoadMore(loadMore);
  };

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

    window.addEventListener('scroll', onScroll, {passive: true});
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
    app.remainHeight = scrollHeight - bottom + BASE_REMAIN_HEIGHT;
    app.requestTime = Date.now();

    onScroll();
  }

  function request({force} = {}) {
    const url = app.requestURL;
    if (!url || url === app.lastRequestURL || app.loadedURLs.has(url))
      return;
    if (!url.startsWith(location.origin + '/')) {
      statusShow({error: chrome.i18n.getMessage('error_origin')});
      return;
    }
    if (!force && Date.now() - app.requestTime < MIN_REQUEST_INTERVAL) {
      setTimeout(onScroll, MIN_REQUEST_INTERVAL);
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
    const doc = event.target.response;
    for (const el of doc.getElementsByTagName('script'))
      el.remove();

    let pages, nextUrl;
    try {
      pages = xpather.getElements(app.rule.pageElement, doc);
      nextUrl = getNextURL(app.rule.nextLink, doc, app.requestURL);
    } catch (e) {
      statusShow({error: chrome.i18n.getMessage('error_extract_info')});
      return;
    }
    if (!pages || !pages.length) {
      terminate();
      return;
    }

    app.loadedURLs.add(app.requestURL);
    app.requestURL = nextUrl;

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
        href: app.requestURL,
        className: 'autopagerize_link',
        textContent: ++app.pageNum,
      }),
    ]);

    if (!pages.length || pages[0].tagName !== 'TR') {
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

    statusShow({loading: false});
    onScroll();

    if (nextUrl)
      return true;

    terminate();
  }

  function onScroll() {
    const {scrollHeight} = document.scrollingElement;
    const remain = scrollHeight - window.innerHeight - window.scrollY;
    if (app.enabled && remain < app.remainHeight)
      request();
  }

  function terminate() {
    delete window.run;
    delete window.xpather;
    window.removeEventListener('scroll', onScroll);
    statusRemove(1500);
  }

  function doLoadMore(num) {
    app.onPageProcessed =
      --num >= 0 &&
      request({force: true}) && (
        ok => {
          ok && setTimeout(doLoadMore, MIN_REQUEST_INTERVAL, num);
          chrome.runtime.sendMessage({action: 'pagesRemain', num});
        });
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

  function statusCreate() {
    if (status.element && document.contains(status.element))
      return;
    status.element = Object.assign(document.createElement('iframe'), {
      srcdoc: `
        <body style="${important(`
          margin: 0;
          padding: 0;
          color: white;
          background: black;
          font: bold 12px/24px sans-serif;
          text-align: center;
        `)}">${chrome.i18n.getMessage('loading')}...</body>`,
      id: 'autopagerize_message_bar',
      style: important(`
        display: none;
        position: fixed;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 24px;
        border: none;
        opacity: .7;
        z-index: 1000;
      `),
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

    } else if (error !== undefined) {
      show = true;
      statusCreate();
      statusRemove(3000);
      status.element.srcdoc = `
        <body style="${important(`
          margin: 0;
          padding: 0;
          color: white;
          background: maroon;
          font: bold 12px/24px sans-serif;
          text-align: center;
        `)}">${chrome.i18n.getMessage('error')}: ${error}</body>`;
      window.removeEventListener('scroll', onScroll);

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

  function loadSettings(ss) {
    app.enabled = notFalse(ss.enabled);
    status.enabled = notFalse(ss.display_message_bar);
  }

  function important(cssString) {
    return cssString.replace(/;/g, '!important;');
  }

  function notFalse(val) {
    return val !== false;
  }
})();
