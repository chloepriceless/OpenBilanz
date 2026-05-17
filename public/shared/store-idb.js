/* ===========================================================================
 * store-idb.js  -  Browser-Persistenz der OpenBilanz (IndexedDB)
 * ---------------------------------------------------------------------------
 * Speichert Unternehmensdaten und Abschluesse ausschliesslich im Browser des
 * Nutzers (IndexedDB). Es werden keinerlei Daten an einen Server uebertragen.
 * Wird im Website-Modus genutzt; im Selbst-Hosting-Modus uebernimmt lib/store.js.
 *
 * Promise-basiert, ohne Abhaengigkeit. Drei Object-Stores:
 *   unternehmen   Einzelsatz (fixer Schluessel '_id' = 'singleton')
 *   abschluesse   viele Saetze, Schluessel 'id', Index auf 'stichtag'
 *   meta          App-Metadaten (Backup-Status, Datei-Handle, persist-Status)
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StoreIDB = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAME = 'openbilanz', VERSION = 1;
  var dbPromise = null;

  function offen() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (e.oldVersion < 1) {
          db.createObjectStore('unternehmen', { keyPath: '_id' });
          var ab = db.createObjectStore('abschluesse', { keyPath: 'id' });
          ab.createIndex('stichtag', 'stichtag', { unique: false });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        /* kuenftige Versionen: hier additiv erweitern (e.oldVersion pruefen) */
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror   = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Datenbank blockiert - bitte andere OpenBilanz-Tabs schliessen.')); };
    });
    return dbPromise;
  }

  /* Eine Transaktion als Promise; fn(t) setzt synchron alle Requests ab. */
  function tx(stores, modus, fn) {
    return offen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(stores, modus), ergebnis;
        t.oncomplete = function () { resolve(ergebnis); };
        t.onerror    = function () { reject(t.error); };
        t.onabort    = function () { reject(t.error || new Error('Transaktion abgebrochen')); };
        ergebnis = fn(t);
      });
    });
  }
  function req(r) {                       /* IDBRequest -> Promise (in aktiver tx) */
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror   = function () { reject(r.error); };
    });
  }

  /* Erhoeht den Zaehler "ungesicherte Aenderungen seit letztem Export".
   * Laeuft INNERHALB der bereits offenen readwrite-Transaktion. */
  function zaehleAenderung(t) {
    var s = t.objectStore('meta');
    s.get('backup').onsuccess = function (e) {
      var m = e.target.result ||
        { key: 'backup', value: { exportiertAm: null, aenderungen: 0 } };
      m.value.aenderungen = (m.value.aenderungen || 0) + 1;
      s.put(m);
    };
  }

  /* ---- Unternehmen (Einzelsatz) ---------------------------------------- */
  function ladeUnternehmen() {
    return tx(['unternehmen'], 'readonly', function (t) {
      return req(t.objectStore('unternehmen').get('singleton'));
    }).then(function (rec) {
      if (!rec) return null;
      delete rec._id;
      return rec;
    });
  }
  function speichereUnternehmen(obj) {
    var rec = JSON.parse(JSON.stringify(obj || {}));
    rec._id = 'singleton';
    return tx(['unternehmen', 'meta'], 'readwrite', function (t) {
      t.objectStore('unternehmen').put(rec);
      zaehleAenderung(t);
      return null;
    }).then(function () { delete rec._id; return rec; });
  }

  /* ---- Abschluesse ----------------------------------------------------- */
  function listeAbschluesse() {
    return tx(['abschluesse'], 'readonly', function (t) {
      return req(t.objectStore('abschluesse').index('stichtag').getAll());
    });
  }
  function ladeAbschluss(id) {
    return tx(['abschluesse'], 'readonly', function (t) {
      return req(t.objectStore('abschluesse').get(String(id)));
    }).then(function (a) { return a || null; });
  }
  function speichereAbschluss(obj) {
    var rec = JSON.parse(JSON.stringify(obj || {}));
    if (!rec.id) rec.id = 'A-' + Date.now();
    rec.geaendertAm = new Date().toISOString();
    return tx(['abschluesse', 'meta'], 'readwrite', function (t) {
      t.objectStore('abschluesse').put(rec);
      zaehleAenderung(t);
      return null;
    }).then(function () { return rec; });
  }
  function loescheAbschluss(id) {
    return tx(['abschluesse', 'meta'], 'readwrite', function (t) {
      t.objectStore('abschluesse').delete(String(id));
      zaehleAenderung(t);
      return null;
    }).then(function () { return true; });
  }

  /* ---- Meta (Schluessel/Wert) ------------------------------------------ */
  function getMeta(key) {
    return tx(['meta'], 'readonly', function (t) {
      return req(t.objectStore('meta').get(key));
    }).then(function (r) { return r ? r.value : null; });
  }
  function setMeta(key, value) {
    return tx(['meta'], 'readwrite', function (t) {
      t.objectStore('meta').put({ key: key, value: value });
      return null;
    });
  }

  /* ---- Snapshot (Voll-Export/Import) ----------------------------------- */
  function leseSnapshot() {                       /* -> { unternehmen, abschluesse } */
    return Promise.all([ladeUnternehmen(), listeAbschluesse()]).then(function (r) {
      return { unternehmen: r[0], abschluesse: r[1] };
    });
  }
  function schreibeSnapshot(snap) {               /* ersetzt ALLE Daten atomar */
    return tx(['unternehmen', 'abschluesse', 'meta'], 'readwrite', function (t) {
      t.objectStore('unternehmen').clear();
      t.objectStore('abschluesse').clear();
      if (snap && snap.unternehmen) {
        var u = JSON.parse(JSON.stringify(snap.unternehmen));
        u._id = 'singleton';
        t.objectStore('unternehmen').put(u);
      }
      var sa = t.objectStore('abschluesse');
      ((snap && snap.abschluesse) || []).forEach(function (a) { sa.put(a); });
      t.objectStore('meta').put({ key: 'backup',
        value: { exportiertAm: new Date().toISOString(), aenderungen: 0 } });
      return null;
    });
  }

  /* ---- Backup-Status --------------------------------------------------- */
  function backupStatus() {                       /* { exportiertAm, aenderungen } */
    return getMeta('backup').then(function (b) {
      return b || { exportiertAm: null, aenderungen: 0 };
    });
  }
  function markiereExport() {                     /* nach erfolgreichem Export */
    return setMeta('backup', { exportiertAm: new Date().toISOString(), aenderungen: 0 });
  }

  return {
    init: function () { return offen().then(function () {}); },
    ladeUnternehmen: ladeUnternehmen, speichereUnternehmen: speichereUnternehmen,
    listeAbschluesse: listeAbschluesse, ladeAbschluss: ladeAbschluss,
    speichereAbschluss: speichereAbschluss, loescheAbschluss: loescheAbschluss,
    leseSnapshot: leseSnapshot, schreibeSnapshot: schreibeSnapshot,
    backupStatus: backupStatus, markiereExport: markiereExport,
    getMeta: getMeta, setMeta: setMeta
  };
});
