/* global xpather */
'use strict';

window.xpather = {

  MICROFORMAT: {
    url: '.*',
    nextLink: '//a[@rel="next"] | //link[@rel="next"]',
    insertBefore: '//*[contains(@class, "autopagerize_insert_before")]',
    pageElement: '//*[contains(@class, "autopagerize_page_element")]',
  },

  getMatchingRule(rules) {
    rules.push(xpather.MICROFORMAT);
    let pageElementFound = false;
    for (const r of rules) {
      if (xpather.getFirstElement(r.pageElement)) {
        pageElementFound = true;
        if (xpather.getFirstElement(r.nextLink))
          return {rule: r};
      }
    }
    return {pageElementFound};
  },

  getElements(expr, node) {
    const x = xpather.evaluate(expr, node, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    const nodes = [];
    for (let node; (node = x.iterateNext());)
      nodes.push(node);
    return nodes;
  },

  getFirstElement(expr, node) {
    return xpather.evaluate(expr, node, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
  },

  evaluate(expr, node = document, resultType) {
    const doc = node.ownerDocument || node;
    const defaultNS = node.lookupNamespaceURI(null);
    let resolver = doc.createNSResolver(node.documentElement || node);

    if (defaultNS) {
      const defaultPrefix = '__default__';
      const defaultResolver = resolver;
      expr = xpather.addDefaultPrefix(expr, defaultPrefix);
      resolver = prefix =>
        prefix === defaultPrefix ?
          defaultNS :
          defaultResolver.lookupNamespaceURI(prefix);
    }
    return doc.evaluate(expr, node, resolver, resultType, null);
  },

  TOKEN_PATTERN: RegExp(
    [
      /([A-Za-z_\u00c0-\ufffd][\w\-.\u00b7-\ufffd]*|\*)\s*(::?|\()?/,
      /(".*?"|'.*?'|\d+(?:\.\d*)?|\.(?:\.|\d+)?|[)\]])/,
      /(\/\/?|!=|[<>]=?|[([|,=+-])/,
      /([@$])/,
    ].map(rx => rx.source).join('|'),
    'g'
  ),

  addDefaultPrefix(expr, prefix) {
    const TERM = 1;
    const OPERATOR = 2;
    const MODIFIER = 3;
    let tokenType = OPERATOR;
    prefix += ':';
    return expr.replace(xpather.TOKEN_PATTERN, (token, id, suffix, term, operator) => {
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
};
