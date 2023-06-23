'use strict';
// TEST-startsWith: https://www.youtube.com/results
// show missing GIFs in youtube
window.run({
  filterName: 'fix-youtube',
  filter: doc => {
    for (const img of doc.querySelectorAll('img[data-thumb]'))
      if (img.src.endsWith('.gif') && img.dataset.thumb)
        img.src = img.dataset.thumb;
  },
});
