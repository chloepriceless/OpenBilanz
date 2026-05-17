/* ===========================================================================
 * sw.js  -  Service Worker der OpenBilanz
 * ---------------------------------------------------------------------------
 * Macht die Website-Variante offline lauffaehig und installierbar (PWA).
 * Strategie: App-Shell wird bei der Installation vorgehalten (cache-first).
 * Es werden ausschliesslich eigene (statische) Dateien gecacht - niemals
 * Nutzerdaten. Das amtliche Taxonomie-ZIP ist bewusst NICHT Teil der Shell.
 * ========================================================================= */
'use strict';

var CACHE = 'openbilanz-v2';

var SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './shared/positionen.js', './shared/berechnung.js', './shared/taxonomie.js',
  './shared/skr04.js', './shared/steuer.js', './shared/xbrl.js',
  './shared/store-idb.js', './shared/store-adapter.js',
  './shared/validate-browser.js', './shared/obz.js', './shared/fileio.js',
  './assets/marke.png', './assets/favicon.png', './assets/apple-touch-icon.png',
  './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Cache-first fuer GET-Anfragen. Neue Antworten werden nachgecacht;
 * faellt das Netz aus, wird die App-Shell ausgeliefert. */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (treffer) {
      return treffer || fetch(e.request).then(function (resp) {
        if (resp && resp.ok && resp.type === 'basic') {
          var kopie = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, kopie); });
        }
        return resp;
      });
    }).catch(function () { return caches.match('./index.html'); })
  );
});
