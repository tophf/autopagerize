'use strict';

// IIFE simplifies complete unregistering for garbage collection
(() => {

const BASE_REMAIN_HEIGHT = 400;
const MIN_REQUEST_INTERVAL = 2000;
const MICROFORMAT = {
  url: '.*',
  nextLink: '//a[@rel="next"] | //link[@rel="next"]',
  insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
  pageElement: '//*[contains(@class, "autopagerize_page_element")]',
};

/** @type AutoPager */
let ap = null;

class AutoPager {
  constructor(info) {
    this.pageNum = 1;
    this.info = info;
    this.enabled = !window.settings.disable;
    const url = AutoPager.getNextURL(info.nextLink, document, location.href);

    if (!url)
      return;

    if (info.insertBefore)
      this.insertPoint = getFirstElementByXPath(info.insertBefore);

    if (!this.insertPoint) {
      const page = getElementsByXPath(info.pageElement).pop();
      if (!page)
        return;
      if (!page.nextSibling)
        page.parentNode.append(' ');
      this.insertPoint = page.nextSibling;
    }

    this.requestURL = url;
    this.loadedURLs = {};
    this.loadedURLs[location.href] = true;

    window.addEventListener('scroll', AutoPager.scroll, {passive: true});
    chrome.runtime.sendMessage('launched');

    const scrollHeight = document.scrollingElement.scrollHeight;
    const ip = this.insertPoint;
    let bottom = ip.tagName
      ? ip.getBoundingClientRect().top
      : (ip.previousElementSibling || ip.parentNode).getBoundingClientRect().bottom;
    if (!bottom) {
      try {
        bottom = Math.max(
          ...getElementsByXPath(this.info.pageElement)
            .map(el => el.getBoundingClientRect().bottom));
      } catch (e) {}
    }
    if (!bottom)
      bottom = Math.round(scrollHeight * 0.8);
    this.remainHeight = scrollHeight - bottom + BASE_REMAIN_HEIGHT;
    this.reqTime = new Date();
    this.onScroll();
  }

  initMessageBar() {
    if (this.frame && document.contains(this.frame))
      return;
    this.frame = Object.assign(document.createElement('iframe'), {
      srcdoc: important(`
        <body style="
          margin: 0;
          padding: 0;
          color: white;
          background: black;
          font: bold 12px/24px sans-serif;
          text-align: center;
        ">Loading...</body>
      `),
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
    document.body.appendChild(this.frame);
  }

  onScroll() {
    const scrollHeight = document.scrollingElement.scrollHeight;
    const remain = scrollHeight - window.innerHeight - window.scrollY;
    if (this.enabled && remain < this.remainHeight)
      this.request();
  }

  request() {
    if (!this.requestURL || this.lastRequestURL === this.requestURL)
      return;
    const now = new Date();
    if (this.reqTime && now - this.reqTime < MIN_REQUEST_INTERVAL) {
      setTimeout(AutoPager.scroll, MIN_REQUEST_INTERVAL);
      return;
    }
    this.reqTime = now;
    this.lastRequestURL = this.requestURL;
    this.showLoading(true);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.requestURL);
    xhr.responseType = 'document';
    xhr.timeout = 60e3;
    xhr.onload = () => this.load(xhr.response, xhr.responseURL);
    xhr.onerror = xhr.ontimeout = () => this.error();
    xhr.send();
  }

  showLoading(show) {
    show = show && window.settings.display_message_bar;
    if (show)
      this.initMessageBar();
    else if (!this.frame)
      return;
    const style = show ? 'block' : 'none';
    this.frame.style.setProperty('display', style, 'important');
  }

  load(doc, url) {
    if (url && !isSameDomain(url)) {
      this.error();
      return;
    }

    for (const el of doc.getElementsByTagName('script'))
      el.remove();

    let page;
    try {
      page = getElementsByXPath(this.info.pageElement, doc);
      url = AutoPager.getNextURL(this.info.nextLink, doc, this.requestURL);
    } catch (e) {
      this.error();
      return;
    }

    if (!page || !page.length || this.loadedURLs[this.requestURL]) {
      this.terminate();
      return;
    }

    this.loadedURLs[this.requestURL] = true;
    this.requestURL = url;
    this.addPage(doc, page);
    this.showLoading(false);
    this.onScroll();

    if (!url)
      this.terminate();
  }

  addPage(htmlDoc, pages) {
    const HTML_NS = 'http://www.w3.org/1999/xhtml';
    const hr = document.createElementNS(HTML_NS, 'hr');
    const p = document.createElementNS(HTML_NS, 'p');
    hr.className = 'autopagerize_page_separator';
    p.className = 'autopagerize_page_info';

    if (this.insertPoint.ownerDocument !== document) {
      const lastPage = getElementsByXPath(this.info.pageElement).pop();
      if (lastPage) {
        this.insertPoint =
          lastPage.nextSibling ||
          lastPage.parentNode.appendChild(document.createTextNode(' '));
      }
    }

    const parent = this.insertPoint.parentNode;

    if (!pages.length || pages[0].tagName !== 'TR') {
      parent.insertBefore(hr, this.insertPoint);
      parent.insertBefore(p, this.insertPoint);
    } else {
      let cols = 0;
      for (const sibling of parent.children)
        if (sibling.tagName === 'TD' || sibling.tagName === 'TH')
          cols += sibling.colSpan || 1;
      const td = document.createElement('td');
      td.colSpan = cols;
      td.appendChild(p);
      const tr = document.createElement('tr');
      tr.appendChild(td);
      parent.insertBefore(tr, this.insertPoint);
    }

    const aplink = document.createElement('a');
    aplink.className = 'autopagerize_link';
    aplink.href = this.requestURL;
    aplink.textContent = ++this.pageNum;
    p.append('page: ', aplink);

    pages.forEach((p, i) => {
      pages[i] = p = document.importNode(p, true);
      this.insertPoint.parentNode.insertBefore(p, this.insertPoint);
    });
  }

  terminate() {
    delete window.run;
    delete window.settings;
    window.removeEventListener('scroll', AutoPager.scroll);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    setTimeout(() => this.frame && this.frame.remove(), 1500);
  }

  error() {
    window.removeEventListener('scroll', AutoPager.scroll);
    if (!this.frame)
      return;
    this.frame.srcdoc = important(`
      <body style="
        margin: 0;
        padding: 0;
        color: white;
        background: maroon;
        font: bold 12px/24px sans-serif;
        text-align: center;
      ">Error!</body>
    `);
    this.frame.style.setProperty('display', 'block', 'important');
    setTimeout(() => this.frame && this.frame.remove(), 3000);
  }

  static scroll() {
    if (ap)
      ap.onScroll();
  }

  static getNextURL(xpath, doc, url) {
    const next = getFirstElementByXPath(xpath, doc);
    if (next) {
      if (!doc.querySelector('base[href]'))
        doc.head.appendChild(doc.createElement('base')).href = url;
      if (!next.getAttribute('href'))
        next.setAttribute('href', next.getAttribute('action') || next.value);
      return next.href;
    }
  }

  static launch(rules) {
    if (ap && ap.loadedURLs[location.href])
      return ap;
    rules.push(MICROFORMAT);
    for (const r of rules) {
      if (getFirstElementByXPath(r.nextLink) &&
          getFirstElementByXPath(r.pageElement)) {
        ap = new AutoPager(r);
        return ap;
      }
    }
  }
}

// utility functions.

function getElementsByXPath(xpath, node) {
  const x = getXPathResult(xpath, node, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
  const nodes = [];
  for (let node; (node = x.iterateNext());)
    nodes.push(node);
  return nodes;
}

function getFirstElementByXPath(xpath, node) {
  return getXPathResult(xpath, node, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
}

function getXPathResult(xpath, node = document, resultType) {
  const doc = node.ownerDocument || node;
  const defaultNS = node.lookupNamespaceURI(null);
  let resolver = doc.createNSResolver(node.documentElement || node);

  if (defaultNS) {
    const defaultPrefix = '__default__';
    const defaultResolver = resolver;
    xpath = addDefaultPrefix(xpath, defaultPrefix);
    resolver = prefix =>
      prefix === defaultPrefix ?
        defaultNS :
        defaultResolver.lookupNamespaceURI(prefix);
  }
  return doc.evaluate(xpath, node, resolver, resultType, null);
}

function addDefaultPrefix(xpath, prefix) {
  const tokenPattern = /([A-Za-z_\u00c0-\ufffd][\w\-.\u00b7-\ufffd]*|\*)\s*(::?|\()?|(".*?"|'.*?'|\d+(?:\.\d*)?|\.(?:\.|\d+)?|[)\]])|(\/\/?|!=|[<>]=?|[([|,=+-])|([@$])/g;
  const TERM = 1;
  const OPERATOR = 2;
  const MODIFIER = 3;
  let tokenType = OPERATOR;
  prefix += ':';
  return xpath.replace(tokenPattern, (token, id, suffix, term, operator) => {
    if (suffix) {
      tokenType =
        suffix === ':' ||
        suffix === '::' && (id === 'attribute' || id === 'namespace') ?
          MODIFIER :
          OPERATOR;
    } else if (id) {
      if (tokenType === OPERATOR && id !== '*')
        token = prefix + token;
      tokenType = tokenType === TERM ? OPERATOR : TERM;
    } else {
      tokenType =
        term ? TERM :
          operator ? OPERATOR :
            MODIFIER;
    }
    return token;
  });
}

function isSameDomain(url) {
  if (url.match(/^\w+:/)) {
    return location.host === url.split('/')[2];
  } else {
    return true;
  }
}

function important(cssString) {
  return cssString.replace(/;/g, '!important;');
}

function onStorageChanged(changes, area) {
  if (area === 'sync' && changes.settings && ap) {
    window.settings = changes.settings.newValue;
    ap.enabled = !window.settings.disable;
  }
}

chrome.storage.onChanged.addListener(onStorageChanged);

window.run = rules => {
  if (!AutoPager.launch(rules))
    setTimeout(AutoPager.launch, 2000, rules);
};

})();
