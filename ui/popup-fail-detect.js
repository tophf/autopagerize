// check if redirected from popup-fail.html
if (new URLSearchParams(location.search).has('fail')) {
  document.documentElement.classList.add('failed-page');
  window.failedPage = true;
}
