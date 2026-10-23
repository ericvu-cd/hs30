/* Ask LINE to hand this page to an external browser, at most once per URL. */
(function () {
  'use strict';
  if (!/\bLine\//i.test(navigator.userAgent || '')) return;
  try {
    var url = new URL(location.href);
    if (!/^https?:$/.test(url.protocol)) return;
    if (url.searchParams.get('openExternalBrowser') === '1') return;
    url.searchParams.set('openExternalBrowser', '1');
    // The parameter also guards against reload loops when LINE keeps the page inside.
    location.replace(url.href);
  } catch (e) {
    // Keep the website usable if URL handling is unavailable.
  }
}());

