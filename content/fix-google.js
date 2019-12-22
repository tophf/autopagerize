'use strict';

// show missing images in google news pages
window.run({
  filterName: 'fix-google',
  filter: doc => {
    const script = [...doc.getElementsByTagName('script')]
      .find(el => el.text.includes('_setImagesSrc'));
    if (!script)
      return;
    const re = /["'](data:image.*?)["'].*?\[(.*?)]\W*_setImagesSrc/g;
    let m;
    while ((m = re.exec(script.text))) {
      const [, dataUrl, ids] = m;
      for (const id of ids.match(/[^,'"]+/g) || []) {
        const el = doc.getElementById(id);
        if (el)
          el.src = dataUrl.replace(/\\x([0-9a-f]{2})/gi, (_, code) =>
            String.fromCharCode(parseInt(code, 16)));
      }
    }
  },
});
