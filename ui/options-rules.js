export {
  collectRules,
  loadRules,
  resizeArea,
  rulesEqual,
};

import {arrayOrDummy} from '/util/common.js';
import {$, $$} from '/util/dom.js';
import {i18n} from '/util/locale.js';

const DUMMY_RULE = {url: '^https?://www\\.'};
let defaultAreaHeight;

function loadRules(rules) {

  const rulesContainer = $('#rules');
  rulesContainer.addEventListener('focusin', resizeArea);
  rulesContainer.addEventListener('focusout', resizeArea);
  rulesContainer.addEventListener('input', resizeArea);
  rulesContainer.addEventListener('input', onInput);
  rulesContainer.addEventListener('click', onClick);

  rules = arrayOrDummy(rules);
  const bin = addRules(rules.length ? rules : [DUMMY_RULE]);
  if (bin.firstChild) {
    rulesContainer.appendChild(bin);
    rulesContainer.closest('details').open = true;
  }

}

function collectRules(elements) {
  const rules = [];
  for (const r of elements || $$('#rules .rule')) {
    if (r.classList.contains('deleted'))
      continue;
    const rule = {};
    let isDummy = true;
    for (const m of $$('.rule-member', r)) {
      const el = $('textarea', m);
      const value = el.value.trim();
      const v = el._data.savedValue = value;
      if (!v)
        continue;
      if (isDummy && v !== (DUMMY_RULE[el.dataset.type] || ''))
        isDummy = false;
      rule[$('.rule-member-name', m).textContent] = v;
    }
    if (!isDummy)
      rules.push(rule);
  }
  return rules;
}

function addRules(rules) {
  const bin = document.createDocumentFragment();
  const tplRule = $('#tplRule').content.firstElementChild;
  const tplMember = $('#tplRuleMember').content.firstElementChild;
  const memberName = $('.rule-member-name', tplMember).firstChild;
  const memberTitle = memberName.parentNode.attributes.title;
  const KEYS = ['url', 'pageElement', 'nextLink', 'insertBefore'];
  let clone;
  for (const rule of rules) {
    if (rule) {
      const el = tplRule.cloneNode(true);
      el._data = {savedValue: false};
      for (const k of KEYS) {
        memberName.nodeValue = k;
        memberTitle.nodeValue = k;
        clone = tplMember.cloneNode(true);
        const area = clone.getElementsByTagName('textarea')[0];
        const v = rule[k] || '';
        area._data = {};
        area.value = area._data.savedValue = v;
        area.dataset.type = k;
        if (!v)
          area.classList.add('empty');
        if (k === 'insertBefore')
          area.required = false;
        el.appendChild(clone);
      }
      bin.appendChild(el);
    }
  }
  return bin;
}

function resizeArea(e) {
  const el = e.target;
  if (el.localName !== 'textarea')
    return;
  if (!defaultAreaHeight)
    defaultAreaHeight = el.offsetHeight;
  switch (e.type) {
    case 'focusin': {
      const sh = el.scrollHeight;
      if (sh > defaultAreaHeight * 1.5)
        el.style.height = sh + 'px';
      break;
    }
    case 'focusout': {
      if (el.style.height)
        el.style.height = '';
      break;
    }
    case 'input': {
      const sh = el.scrollHeight;
      const oh = el.offsetHeight;
      if (sh > oh + defaultAreaHeight / 2 || sh < oh)
        el.style.height = sh > defaultAreaHeight ? sh + 'px' : '';
      break;
    }
  }
}

function validateArea(el) {
  const v = el.value.trim();
  let error = '';
  if (v) {
    try {
      if (el.dataset.type === 'url')
        RegExp(v);
      else
        document.evaluate(v, document, null, XPathResult.ANY_TYPE, null);
    } catch (e) {
      error = String(e);
      const i = (error.indexOf(`'${v}'`) + 1) || (error.indexOf(`/${v}/`) + 1);
      if (i > 0)
        error = error.slice(i + v.length + 2).replace(/^[\s:]*(is\s)?|\.$/g, '');
    }
  } else if (el.required) {
    error = i18n('errorEmptyValue');
  }
  el.setCustomValidity(error);
  el.classList.toggle('empty', !v);
  el.title = error;
}

function onInput({target: el}) {
  if (el.localName === 'textarea')
    validateArea(el);
}

function addRule(base) {
  base.after(addRules([DUMMY_RULE]));
}

function deleteRule(base) {
  base.classList.toggle('deleted');
  base.value = !base.value;
  const isDisposable = base.value &&
                       $('#rules').children[1] &&
                       rulesEqual(collectRules([base]), [DUMMY_RULE]);
  if (isDisposable)
    base.value = base._data.savedValue = 'canDelete';
  base.dispatchEvent(new Event('change', {bubbles: true}));
  if (base.value === 'canDelete')
    base.remove();
  else
    $('[data-action="delete"]', base).textContent =
      i18n(base.value ? 'restore' : 'delete');
}

function onClick(e) {
  if (e.defaultPrevented)
    return;
  const {action} = e.target.dataset;
  if (action) {
    e.preventDefault();
    const fn = action === 'add' ? addRule : deleteRule;
    fn(e.target.closest('.rule'));
  }
}

function rulesEqual(arrayA, arrayB) {
  arrayA = arrayOrDummy(arrayA);
  arrayB = arrayOrDummy(arrayB);
  if (arrayA.length !== arrayB.length)
    return;
  for (let i = 0; i < arrayA.length; i++) {
    const a = arrayA[i];
    const b = arrayB[i];
    if (!a || !b)
      return;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] !== b[k])
        return;
    }
  }
  return true;
}
