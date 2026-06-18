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

var CACHE = 'openbilanz-v7';

// Vollständiger Modulbestand von public/shared/ — sonst fehlen Module beim
// Offline-Start (Network-First fällt offline auf den Cache zurück). Bei einem
// neuen shared-Modul hier ergänzen UND CACHE-Version erhöhen (idealerweise
// build-seitig aus dem Verzeichnis generieren).
var SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './pyodide-worker.js',
  './shared/ausgangsrechnung.js', './shared/autocomplete.js', './shared/belege.js',
  './shared/belegnummern.js', './shared/berechnung.js', './shared/bilanz-pdf.js',
  './shared/buchungspruefung.js', './shared/closing.js', './shared/datev.js',
  './shared/fileio.js', './shared/fristen.js', './shared/fx.js',
  './shared/gdpdu.js', './shared/healthcheck.js', './shared/import-protokoll.js',
  './shared/importe.js', './shared/journalexport.js', './shared/kontenabschluss.js',
  './shared/mandanten-migration.js', './shared/mt940.js', './shared/obz.js',
  './shared/palette.js', './shared/pdfa3.js', './shared/positionen.js',
  './shared/pruefkette.js', './shared/skr04.js', './shared/skr04-glossar.js',
  './shared/skr04-voll.js', './shared/stbpaket.js', './shared/steuer.js',
  './shared/store-adapter.js', './shared/store-idb.js', './shared/taxonomie.js',
  './shared/umbuchung.js', './shared/unterschrift-pdf.js', './shared/ustid.js',
  './shared/ustva.js', './shared/validate-browser.js', './shared/version.js',
  './shared/vorlagen.js', './shared/xbrl.js', './shared/xrechnung-cii.js',
  './shared/xrechnung-ubl.js', './shared/zugferd-pdf.js',
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
