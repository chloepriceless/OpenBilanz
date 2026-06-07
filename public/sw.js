/* ===========================================================================
 * sw.js  -  Service Worker der OpenBilanz
 * ---------------------------------------------------------------------------
 * Macht die Website-Variante offline lauffaehig und installierbar (PWA).
 *
 * Strategie:
 *   - App-Code (HTML/JS/CSS) wird NETWORK-FIRST geladen: stets die aktuelle
 *     Version, der Cache dient nur als Offline-Rueckfall. So erreichen
 *     Updates die Nutzer sofort - kein "haengen gebliebener" alter Stand.
 *   - Statische Assets (Bilder, Icons) werden cache-first ausgeliefert.
 *   - Bei jeder Aenderung an der App die CACHE-Version erhoehen.
 *
 * Es werden ausschliesslich eigene (statische) Dateien gecacht - niemals
 * Nutzerdaten. Das amtliche Taxonomie-ZIP ist bewusst NICHT Teil der Shell.
 * ========================================================================= */
'use strict';

var CACHE = 'openbilanz-v6';

var SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './pyodide-worker.js',
  './shared/positionen.js', './shared/berechnung.js', './shared/taxonomie.js',
  './shared/skr04.js', './shared/steuer.js', './shared/ustva.js',
  './shared/mt940.js', './shared/datev.js', './shared/importe.js',
  './shared/import-protokoll.js',
  './shared/journalexport.js',
  './shared/gdpdu.js', './shared/pruefkette.js', './shared/xbrl.js',
  './shared/mandanten-migration.js',
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

/* Legt eine Antwort im Cache ab (nur erfolgreiche, eigene Antworten). */
function nachcachen(req, resp) {
  if (resp && resp.ok && resp.type === 'basic') {
    var kopie = resp.clone();
    caches.open(CACHE).then(function (c) { c.put(req, kopie); });
  }
  return resp;
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var pfad = new URL(e.request.url).pathname;
  /* App-Code: Verzeichnis-/Navigationsanfragen und HTML/JS/CSS/Manifest. */
  var istCode = /(\/|\.html|\.js|\.css|\.webmanifest)$/.test(pfad);

  if (istCode) {
    /* Network-first: aktuelle Version laden, Cache nur als Offline-Rueckfall. */
    e.respondWith(
      fetch(e.request).then(function (resp) {
        return nachcachen(e.request, resp);
      }).catch(function () {
        return caches.match(e.request).then(function (t) {
          return t || caches.match('./index.html');
        });
      })
    );
  } else {
    /* Cache-first fuer statische Assets (Bilder, Icons). */
    e.respondWith(
      caches.match(e.request).then(function (treffer) {
        return treffer || fetch(e.request).then(function (resp) {
          return nachcachen(e.request, resp);
        });
      }).catch(function () { return caches.match('./index.html'); })
    );
  }
});
