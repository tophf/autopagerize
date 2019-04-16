/* global utils */
'use strict';

// IIFE simplifies complete unregistering for garbage collection
(() => {
  const BASE_REMAIN_HEIGHT = 400;
  const MIN_REQUEST_INTERVAL = 2000;

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
        this.insertPoint = utils.getFirstElementByXPath(info.insertBefore);

      if (!this.insertPoint) {
        const page = utils.getElementsByXPath(info.pageElement).pop();
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
            ...utils.getElementsByXPath(this.info.pageElement)
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
        srcdoc: utils.important(`
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
        style: utils.important(`
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
      if (url && !utils.isSameDomain(url)) {
        this.error();
        return;
      }

      for (const el of doc.getElementsByTagName('script'))
        el.remove();

      let pages;
      try {
        pages = utils.getElementsByXPath(this.info.pageElement, doc);
        url = AutoPager.getNextURL(this.info.nextLink, doc, this.requestURL);
      } catch (e) {
        this.error();
        return;
      }

      if (!pages || !pages.length || this.loadedURLs[this.requestURL]) {
        this.terminate();
        return;
      }

      this.loadedURLs[this.requestURL] = true;
      this.requestURL = url;
      this.addPage(doc, pages);
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
        const lastPage = utils.getElementsByXPath(this.info.pageElement).pop();
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

      const bin = document.createDocumentFragment();
      pages.forEach(p => bin.appendChild(p));
      this.insertPoint.parentNode.insertBefore(bin, this.insertPoint);
    }

    terminate() {
      delete window.run;
      delete window.utils;
      delete window.settings;
      window.removeEventListener('scroll', AutoPager.scroll);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      setTimeout(() => this.frame && this.frame.remove(), 1500);
    }

    error() {
      window.removeEventListener('scroll', AutoPager.scroll);
      if (!this.frame)
        return;
      this.frame.srcdoc = utils.important(`
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
      const next = utils.getFirstElementByXPath(xpath, doc);
      if (next) {
        if (doc !== document && !doc.querySelector('base[href]'))
          doc.head.appendChild(doc.createElement('base')).href = url;
        if (!next.getAttribute('href'))
          next.setAttribute('href', next.getAttribute('action') || next.value);
        return next.href;
      }
    }

    static launch(rules, matchedRule) {
      if (ap && ap.loadedURLs[location.href])
        return ap;
      if (!matchedRule)
        matchedRule = utils.getMatchingRule(rules);
      if (matchedRule) {
        ap = new AutoPager(matchedRule);
        return ap;
      }
    }
  }

  function onStorageChanged(changes, area) {
    if (area === 'sync' && changes.settings && ap) {
      window.settings = changes.settings.newValue;
      ap.enabled = !window.settings.disable;
    }
  }

  chrome.storage.onChanged.addListener(onStorageChanged);

  window.run = (rules, matchedRule) => {
    if (!AutoPager.launch(rules, matchedRule))
      setTimeout(AutoPager.launch, 2000, rules);
  };
})();
