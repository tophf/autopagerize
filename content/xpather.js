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
    for (const r of rules) {
      if (xpather.getFirst(r.pageElement) &&
          xpather.getFirst(r.nextLink))
        return r;
    }
  },

  /**
   * @param {string} expr
   * @param {Node} [node]
   * @return {(Node|Element)[]}
   */
  getElements(expr, node) {
    const x = xpather.evaluate(expr, node, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    const nodes = [];
    for (let node; (node = x?.iterateNext());)
      nodes.push(node);
    return nodes;
  },

  /**
   * @param {string} expr
   * @param {Node} [node]
   * @return {?Node|Element}
   */
  getFirst(expr, node) {
    return xpather.evaluate(expr, node, XPathResult.FIRST_ORDERED_NODE_TYPE)?.singleNodeValue;
  },

  /**
   * @param {string} expr
   * @param {Node} [node]
   * @return {?Node|Element}
   */
  getLast(expr, node) {
    return xpather.getFirst(`(${expr})[last()]`, node);
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
    try {
      return doc.evaluate(expr, node, resolver, resultType, null);
    } catch (e) {
      console.debug(e);
    }
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

  onmessage([cmd, arg, arg2], sender, sendResponse) {
    let res;
    switch (cmd) {

      case 'ping':
        res = true;
        break;

      case 'checkOrphan': {
        const id = chrome.runtime.id;
        const idCheck = id + ':terminated';
        const orphanTerminated = () => (res = true);
        addEventListener(idCheck, orphanTerminated);
        dispatchEvent(new Event(id));
        removeEventListener(idCheck, orphanTerminated);
        break;
      }

      case 'checkRules':
        res = self.xpather?.getMatchingRule;
        if (!res)
          break;
        if ((res = res(arg))) {
          clearTimeout(self.retryTimer);
          delete self.retryTimer;
          self.rules = arg;
          self.matchedRule = res;
          res = {
            hasRule: true,
            hasRun: typeof run === 'function',
          };
        } else {
          self.retryTimer = setTimeout(() => {
            if (typeof run !== 'function')
              delete self.xpather;
          }, arg2 * 1.5);
        }
        break;

      case 'launch':
        if (typeof run !== 'function')
          break;
        if (!arg2)
          self.dispatchEvent(new Event(chrome.runtime.id));
        // eslint-disable-next-line no-undef
        run({rules, matchedRule, settings: arg});
        self.launched = 1;
        delete self.rules;
        delete self.matchedRule;
        break;

      case 'launched':
        res = self[cmd] === 1;
        delete self[cmd];

      // fallthrough
      case 'run':
        if (typeof run === 'function')
          run(arg);
        break;
    }
    sendResponse(res ?? null);
  },
};

chrome.runtime.onMessage.addListener(xpather.onmessage);
dispatchEvent(new Event(chrome.runtime.id));
