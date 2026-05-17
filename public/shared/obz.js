/* ===========================================================================
 * obz.js  -  OpenBilanz-Sicherungsdatei (.obz): packen, entpacken, verschluesseln
 * ---------------------------------------------------------------------------
 * Eine .obz-Datei ist ein vollstaendiger Schnappschuss aller Daten
 * (Unternehmen + alle Abschluesse). Sie dient als Backup und als Weg, einen
 * Stand auf ein anderes Geraet/in einen anderen Browser zu uebertragen.
 *
 * Optional passwortgeschuetzt: PBKDF2-HMAC-SHA-256 (Schlusselableitung) +
 * AES-GCM-256 (Verschluesselung, integritaetsgesichert). Ohne Passwort wird
 * lesbares JSON geschrieben. Der GCM-Tag dient zugleich als Passwortpruefung.
 *
 * Die Datei ist stets ein UTF-8-JSON-Umschlag, damit der Import verschluesselt
 * und unverschluesselt automatisch unterscheiden kann.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OBZ = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;          /* Datenmodell des snapshot-Objekts */
  var OBZ_VERSION = 1;             /* Aufbau des Datei-Umschlags */
  var ITERATIONEN = 600000;        /* PBKDF2-SHA256, OWASP-Empfehlung 2024/2025 */
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(buf) {
    var b = new Uint8Array(buf), s = '', i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), b = new Uint8Array(s.length), i;
    for (i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function schluessel(passwort, salt, iter) {
    return crypto.subtle.importKey('raw', enc.encode(passwort), 'PBKDF2',
        false, ['deriveKey'])
      .then(function (km) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  /* Baut das vollstaendige snapshot-Objekt aus { unternehmen, abschluesse }. */
  function baueSnapshot(daten) {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportiertAm: new Date().toISOString(),
      app: 'OpenBilanz',
      unternehmen: (daten && daten.unternehmen) || null,
      abschluesse: (daten && daten.abschluesse) || []
    };
  }

  /* ---- Packen: { unternehmen, abschluesse } -> .obz-Bytes (Uint8Array) -- */
  function packen(daten, passwort) {
    var snapshot = baueSnapshot(daten);
    if (!passwort) {
      var huelleK = { format: 'obz', obzVersion: OBZ_VERSION,
                      verschluesselt: false, snapshot: snapshot };
      return Promise.resolve(enc.encode(JSON.stringify(huelleK, null, 2)));
    }
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv   = crypto.getRandomValues(new Uint8Array(12));
    return schluessel(passwort, salt, ITERATIONEN).then(function (k) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k,
                                   enc.encode(JSON.stringify(snapshot)));
    }).then(function (ct) {
      var huelleV = {
        format: 'obz', obzVersion: OBZ_VERSION, verschluesselt: true,
        kdf:    { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONEN, salt: b64(salt) },
        cipher: { name: 'AES-GCM', iv: b64(iv) },
        daten:  b64(ct)
      };
      return enc.encode(JSON.stringify(huelleV, null, 2));
    });
  }

  /* ---- Entpacken: .obz-Bytes -> snapshot ------------------------------- *
   * passwortFn: () -> Promise<string>, wird nur bei verschluesselten Dateien
   * aufgerufen. Wirft sprechende Fehler bei ungueltiger Datei / falschem PW. */
  function entpacken(arrayBuffer, passwortFn) {
    var huelle;
    try { huelle = JSON.parse(dec.decode(arrayBuffer)); }
    catch (e) { return Promise.reject(new Error('Keine gueltige OpenBilanz-Sicherung (.obz).')); }
    if (!huelle || huelle.format !== 'obz')
      return Promise.reject(new Error('Unbekanntes Dateiformat - keine .obz-Sicherung.'));

    var fertig;
    if (!huelle.verschluesselt) {
      fertig = Promise.resolve(huelle.snapshot);
    } else {
      fertig = Promise.resolve(passwortFn()).then(function (pw) {
        if (!pw) throw new Error('Kein Passwort eingegeben.');
        var salt = unb64(huelle.kdf.salt), iv = unb64(huelle.cipher.iv);
        return schluessel(pw, salt, huelle.kdf.iterations).then(function (k) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k,
                                       unb64(huelle.daten));
        }).then(function (pt) {
          return JSON.parse(dec.decode(pt));
        }).catch(function (e) {
          if (e && e.message && e.message.indexOf('Passwort') >= 0) throw e;
          throw new Error('Entschluesselung fehlgeschlagen - falsches Passwort?');
        });
      });
    }
    return fertig.then(function (snapshot) {
      if (!snapshot || typeof snapshot !== 'object')
        throw new Error('Sicherung enthaelt keine Daten.');
      if (snapshot.schemaVersion > SCHEMA_VERSION)
        throw new Error('Die Sicherung stammt aus einer neueren OpenBilanz-Version.');
      return snapshot;
    });
  }

  return { packen: packen, entpacken: entpacken,
           SCHEMA_VERSION: SCHEMA_VERSION, ITERATIONEN: ITERATIONEN };
});
