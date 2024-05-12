'use strict';

// show images
window.run({
  filter(doc) {
    const re = /["'](data:image[^"']+)["'].*?\[(.*?)]\W*_setImagesSrc/g;
    for (const {text} of doc.getElementsByTagName('script')) {
      if (!text.includes('_setImagesSrc'))
        continue;
      let m;
      while ((m = re.exec(text))) {
        const [, dataUrl, ids] = m;
        for (const id of ids.match(/[^,'"]+/g) || []) {
          let el = doc.getElementById(id);
          if (!el) continue;
          el.src = dataUrl.replace(/\\x([0-9a-f]{2})/gi, (_, code) =>
            String.fromCharCode(parseInt(code, 16)));
          if ((el = el.closest('[style*="display:none"]')))
            el.style.removeProperty('display');
        }
      }
    }
  },
});
