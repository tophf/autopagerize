export {
  loadRules,
  collectRules,
  rulesEqual,
};

const DUMMY_RULE = {url: '^https?://www\\.'};
let defaultAreaHeight;

function loadRules(rules) {

  const rulesContainer = $.rules;
  rulesContainer.addEventListener('focusin', expandArea);
  rulesContainer.addEventListener('focusout', shrinkArea);
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
  for (const r of elements || $.rules.getElementsByClassName('rule')) {
    if (r.classList.contains('deleted'))
      continue;
    const rule = {};
    let isDummy = true;
    for (const m of r.getElementsByClassName('rule-member')) {
      const el = m.getElementsByTagName('textarea')[0];
      const value = el.value.trim();
      const v = el.savedValue = value;
      if (!v)
        continue;
      if (isDummy && v !== (DUMMY_RULE[el.dataset.type] || ''))
        isDummy = false;
      rule[m.querySelector('.rule-member-name').textContent] = v;
    }
    if (!isDummy)
      rules.push(rule);
  }
  return rules;
}

function addRules(rules) {
  const bin = document.createDocumentFragment();
  const tplRule = $['tpl:rule'].content.firstElementChild;
  const tplMember = $['tpl:ruleMember'].content.firstElementChild;
  const memberName = tplMember.querySelector('.rule-member-name').firstChild;
  const memberTitle = memberName.parentNode.attributes.title;
  const KEYS = ['url', 'pageElement', 'nextLink', 'insertBefore'];
  let clone;
  for (const rule of rules) {
    if (rule) {
      const el = tplRule.cloneNode(true);
      el.savedValue = false;
      for (const k of KEYS) {
        memberName.nodeValue = k;
        memberTitle.nodeValue = k;
        clone = tplMember.cloneNode(true);
        const area = clone.getElementsByTagName('textarea')[0];
        const v = rule[k] || '';
        area.value = area.savedValue = v;
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

function expandArea(e) {
  const el = e.target;
  if (el.localName !== 'textarea')
    return;
  if (!defaultAreaHeight)
    defaultAreaHeight = el.offsetHeight;
  const sh = el.scrollHeight;
  if (sh > defaultAreaHeight * 1.5)
    el.style.height = sh + 'px';
}

function shrinkArea(e) {
  const el = e.target;
  if (el.localName !== 'textarea' || !el.style.height)
    return;
  el.style.height = '';
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
  if (el.localName !== 'textarea')
    return;
  validateArea(el);
  const sh = el.scrollHeight;
  const oh = el.offsetHeight;
  if (sh > oh + defaultAreaHeight / 2 || sh < oh)
    el.style.height = sh > defaultAreaHeight ? sh + 'px' : '';
}

function addRule(base) {
  base.after(addRules([DUMMY_RULE]));
}

function deleteRule(base) {
  base.classList.toggle('deleted');
  base.value = !base.value;
  const isDisposable = base.value &&
                       $.rules.children[1] &&
                       rulesEqual(collectRules([base]), [DUMMY_RULE]);
  if (isDisposable)
    base.value = base.savedValue = 'canDelete';
  base.dispatchEvent(new Event('change', {bubbles: true}));
  if (base.value === 'canDelete')
    base.remove();
  else
    base.querySelector('[data-action="delete"]').textContent =
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
