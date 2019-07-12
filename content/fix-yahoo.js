'use strict';

// show missing images in yahoo news
window.run({
  filterName: 'fix-yahoo',
  filter: doc => {
    for (const img of doc.querySelectorAll('img.s-img[data-src]'))
      img.src = img.dataset.src;
  },
});
