'use strict';

// show missing images in google news pages
window.run({
  filterName: 'fix-google-news',
  filter: doc => {
    const script = [...doc.getElementsByTagName('script')]
      .find(el => el.text.includes('_setImagesSrc'));
    if (!script)
      return;
    const re = /(["'])(data:image.*?)\1[\s\S]*?(["'])(news-thumbnail-image-.*?)\3/g;
    let m;
    while ((m = re.exec(script.text))) {
      const [, /*quote*/, dataUrl, /*quote*/, id] = m;
      const el = doc.getElementById(id);
      if (el)
        el.src = dataUrl.replace(/\\x[0-9a-f]{2}/gi, s => String.fromCharCode('0' + s.slice(1)));
    }
  },
});
