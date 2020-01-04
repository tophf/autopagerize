'use strict';

// show missing images in google news pages
window.run({
  filterName: 'fix-google',
  filter: doc => {
    const re = /["'](data:image[^"']+)["'].*?\[(.*?)]\W*_setImagesSrc/g;
    for (const {text} of doc.getElementsByTagName('script')) {
      if (!text.includes('_setImagesSrc'))
        continue;
      let m;
      while ((m = re.exec(text))) {
        const [, dataUrl, ids] = m;
        for (const id of ids.match(/[^,'"]+/g) || []) {
          const el = doc.getElementById(id);
          if (el)
            el.src = dataUrl.replace(/\\x([0-9a-f]{2})/gi, (_, code) =>
              String.fromCharCode(parseInt(code, 16)));
        }
      }
    }
  },
});
