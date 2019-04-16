/* global utils */
'use strict';

window.utils = {

  MICROFORMAT: {
    url: '.*',
    nextLink: '//a[@rel="next"] | //link[@rel="next"]',
    insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
    pageElement: '//*[contains(@class, "autopagerize_page_element")]',
  },

  getMatchingRule(rules) {
    rules.push(utils.MICROFORMAT);
    for (const r of rules) {
      if (utils.getFirstElementByXPath(r.nextLink) &&
          utils.getFirstElementByXPath(r.pageElement)) {
        return r;
      }
    }
  },

  getElementsByXPath(xpath, node) {
    const x = utils.getXPathResult(xpath, node, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    const nodes = [];
    for (let node; (node = x.iterateNext());)
      nodes.push(node);
    return nodes;
  },

  getFirstElementByXPath(xpath, node) {
    return utils.getXPathResult(xpath, node, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
  },

  getXPathResult(xpath, node = document, resultType) {
    const doc = node.ownerDocument || node;
    const defaultNS = node.lookupNamespaceURI(null);
    let resolver = doc.createNSResolver(node.documentElement || node);

    if (defaultNS) {
      const defaultPrefix = '__default__';
      const defaultResolver = resolver;
      xpath = utils.addDefaultPrefix(xpath, defaultPrefix);
      resolver = prefix =>
        prefix === defaultPrefix ?
          defaultNS :
          defaultResolver.lookupNamespaceURI(prefix);
    }
    return doc.evaluate(xpath, node, resolver, resultType, null);
  },

  addDefaultPrefix(xpath, prefix) {
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
  },

  isSameDomain(url) {
    if (url.match(/^\w+:/)) {
      return location.host === url.split('/')[2];
    } else {
      return true;
    }
  },

  important(cssString) {
    return cssString.replace(/;/g, '!important;');
  },
};
