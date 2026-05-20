/* ===========================================================================
 * belege.js  -  Beleg-Hashes (SHA-256) und Metadaten pro Buchung
 * ---------------------------------------------------------------------------
 * Eine Buchung erhaelt optional ein Feld
 *   b.beleg = { name: 'rechnung-2026-042.pdf', sha256: '64-Hex',
 *               groesseBytes: 102400, eingelesenAm: 'YYYY-MM-DDTHH:MM:SSZ' }
 *
 * Diese Metadaten ermoeglichen es, die zugehoerige Datei spaeter zu
 * verifizieren - wer in zehn Jahren beweisen muss, dass eine archivierte PDF
 * zur Buchung gehoert, vergleicht den SHA-256-Hash der Datei mit beleg.sha256.
 *
 * Die Datei selbst wird hier NICHT persistiert. Der Nutzer ist verantwortlich
 * fuer die separate Ablage (z. B. data/belege/<sha256>.<ext> im Selbst-Hosting
 * oder in einem versionierten Dokumentenordner). So bleiben die Abschluesse
 * schlank in JSON und unabhaengig von der Belegmasse.
 *
 * API:
 *   sha256Hex(bytes|String) -> Promise<String>      (Web-Crypto / Node-Crypto)
 *   sha256HexSync(bytes|String) -> String           (Node-Fallback, synchron)
 *   formatiereBeleg(beleg)   -> String              (kompakte Anzeige)
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Belege = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function toBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (typeof input === 'string') {
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(input);
      // Node-Fallback
      var b = Buffer.from(input, 'utf8');
      var arr = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) arr[i] = b[i];
      return arr;
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
      var arr2 = new Uint8Array(input.length);
      for (var j = 0; j < input.length; j++) arr2[j] = input[j];
      return arr2;
    }
    throw new Error('Belege.sha256: unsupported input type');
  }

  function hex(bytes) {
    var h = '';
    for (var i = 0; i < bytes.length; i++) {
      h += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return h;
  }

  function sha256Hex(input) {
    var bytes = toBytes(input);
    // Browser: Web Crypto
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
        return hex(new Uint8Array(buf));
      });
    }
    // Node-Fallback
    if (typeof require === 'function') {
      try {
        var nc = require('crypto');
        var h = nc.createHash('sha256');
        h.update(Buffer.from(bytes));
        return Promise.resolve(h.digest('hex'));
      } catch (e) {}
    }
    return Promise.reject(new Error('Kein SHA-256-Backend verfuegbar'));
  }

  function sha256HexSync(input) {
    var bytes = toBytes(input);
    if (typeof require === 'function') {
      try {
        var nc = require('crypto');
        var h = nc.createHash('sha256');
        h.update(Buffer.from(bytes));
        return h.digest('hex');
      } catch (e) {}
    }
    throw new Error('sha256HexSync nur in Node verfuegbar');
  }

  function formatiereBeleg(b) {
    if (!b || !b.sha256) return '';
    var groesse = b.groesseBytes;
    var g = !groesse ? ''
      : groesse < 1024 ? groesse + ' B'
      : groesse < 1024 * 1024 ? (Math.round(groesse / 1024 * 10) / 10) + ' KB'
      : (Math.round(groesse / 1024 / 1024 * 10) / 10) + ' MB';
    return (b.name || '—') + (g ? ' (' + g + ')' : '') +
      ' · sha256 ' + String(b.sha256).slice(0, 12) + '…';
  }

  return {
    sha256Hex: sha256Hex,
    sha256HexSync: sha256HexSync,
    formatiereBeleg: formatiereBeleg
  };
});
