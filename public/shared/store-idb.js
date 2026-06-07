/* ===========================================================================
 * store-idb.js  -  Browser-Persistenz der OpenBilanz (IndexedDB, mandantenfaehig)
 * ---------------------------------------------------------------------------
 * Speichert Unternehmensdaten und Abschluesse ausschliesslich im Browser des
 * Nutzers (IndexedDB). Es werden keinerlei Daten an einen Server uebertragen.
 * Wird im Website-Modus genutzt; im Selbst-Hosting-Modus uebernimmt lib/store.js.
 *
 * Seit Welle 7 MEHRMANDANTENFAEHIG (DB-Version 2):
 *   unternehmen   ein Satz JE MANDANT, Schluessel '_id' = mandantId
 *   abschluesse   viele Saetze, Schluessel 'id', Feld+Index 'mandantId'
 *   mandanten     Mandanten-Index, Schluessel 'id' ({id,name,angelegtAm})
 *   meta          App-Metadaten (Backup-Status, Datei-Handle, persist-Status)
 *
 * Alle Datenfunktionen nehmen einen optionalen mandantId (Default 'standard').
 *
 * MIGRATION v1->v2 (onupgradeneeded, KORREKTHEITSKRITISCH, Browser-Datenverlust-
 * risiko): bestehende Einfirmen-Daten werden dem Mandanten 'standard' zugeordnet
 * (Unternehmens-Singleton -> _id='standard'; Abschluesse erhalten mandantId;
 * Mandant 'standard' wird angelegt, Name aus Unternehmen). Verlustfrei +
 * idempotent; die Zuordnungsregel ist konsistent zur getesteten reinen Transform
 * (mandanten-migration.js). Leere v1-DB (nie Daten gespeichert) -> kein Phantom-
 * Mandant. NICHT in Node unit-testbar -> Hub-Re-Refute + manueller Smoke-Test
 * (Alt-DB laden -> alle Daten unter 'standard') VOR Deploy.
 * ========================================================================= */
(function (root, factory) {
  var Transform = (typeof module !== 'undefined' && module.exports)
    ? require('./mandanten-migration.js') : root.MandantenMigration;
  var api = factory(Transform);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StoreIDB = api;
})(typeof self !== 'undefined' ? self : this, function (Transform) {
  'use strict';

  var STD = (Transform && Transform.STANDARD_ID) || 'standard';
  var NAME = 'openbilanz', VERSION = 2;
  var dbPromise = null;

  function mid(mandantId) { return mandantId || STD; }

  /* Migration v1->v2 innerhalb der versionchange-Transaktion. Sequenziell
   * (Unternehmen -> Abschluss-Cursor -> Mandant anlegen), um Races zwischen den
   * asynchronen Requests zu vermeiden. */
  function migriereV1zuV2(t) {
    var us = t.objectStore('unternehmen');
    us.get('singleton').onsuccess = function (ev) {
      var u = ev.target.result, name = 'Standard', hatDaten = false;
      if (u) {
        hatDaten = true;
        name = u.name || u.firma || 'Standard';   /* konsistent zu Transform.nameFuer */
        us.delete('singleton');
        u._id = STD; u.mandantId = STD;
        us.put(u);
      }
      var as = t.objectStore('abschluesse');
      as.openCursor().onsuccess = function (ev2) {
        var c = ev2.target.result;
        if (c) {
          hatDaten = true;
          var rec = c.value;
          if (!rec.mandantId) { rec.mandantId = STD; c.update(rec); }
          c.continue();
        } else if (hatDaten) {
          /* Mandant 'standard' nur anlegen, wenn echte Daten vorhanden waren
           * (kein Phantom-Mandant bei leerer Alt-DB - Vertrag der Transform). */
          t.objectStore('mandanten').put(
            { id: STD, name: name, angelegtAm: new Date().toISOString() });
        }
      };
    };
  }

  function offen() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result, t = e.target.transaction;
        if (e.oldVersion < 1) {
          db.createObjectStore('unternehmen', { keyPath: '_id' });
          var ab = db.createObjectStore('abschluesse', { keyPath: 'id' });
          ab.createIndex('stichtag', 'stichtag', { unique: false });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (e.oldVersion < 2) {
          if (!db.objectStoreNames.contains('mandanten')) {
            db.createObjectStore('mandanten', { keyPath: 'id' });
          }
          var abs = t.objectStore('abschluesse');
          if (!abs.indexNames.contains('mandantId')) {
            abs.createIndex('mandantId', 'mandantId', { unique: false });
          }
          /* Nur ein ECHTES Upgrade einer bestehenden v1-DB migriert Daten;
           * eine frische Installation (oldVersion<1) hat nichts zu migrieren. */
          if (e.oldVersion >= 1) migriereV1zuV2(t);
        }
        /* kuenftige Versionen: hier additiv (e.oldVersion pruefen). */
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

  /* ---- Mandanten-Index ------------------------------------------------- */
  function listeMandanten() {
    return tx(['mandanten'], 'readonly', function (t) {
      return req(t.objectStore('mandanten').getAll());
    }).then(function (l) { return l || []; });
  }
  function speichereMandant(m) {
    var rec = JSON.parse(JSON.stringify(m || {}));
    if (!rec.id) rec.id = STD;
    if (!rec.angelegtAm) rec.angelegtAm = new Date().toISOString();
    if (!rec.name) rec.name = (rec.id === STD ? 'Standard' : rec.id);
    return tx(['mandanten'], 'readwrite', function (t) {
      t.objectStore('mandanten').put(rec); return null;
    }).then(function () { return rec; });
  }
  /* Stellt sicher, dass der Mandant im Index steht (kein Ueberschreiben). */
  function ensureMandant(t, mandantId, name) {
    var id = mid(mandantId), s = t.objectStore('mandanten');
    s.get(id).onsuccess = function (e) {
      if (!e.target.result) {
        s.put({ id: id, name: name || (id === STD ? 'Standard' : id),
          angelegtAm: new Date().toISOString() });
      }
    };
  }
  function loescheMandant(id) {
    var m = mid(id);
    return tx(['mandanten', 'unternehmen', 'abschluesse', 'meta'], 'readwrite', function (t) {
      t.objectStore('mandanten').delete(m);
      t.objectStore('unternehmen').delete(m);
      var idx = t.objectStore('abschluesse').index('mandantId');
      idx.openKeyCursor(IDBKeyRange.only(m)).onsuccess = function (e) {
        var c = e.target.result;
        if (c) { t.objectStore('abschluesse').delete(c.primaryKey); c.continue(); }
      };
      zaehleAenderung(t);
      return null;
    }).then(function () { return true; });
  }

  /* ---- Unternehmen (je Mandant, Schluessel _id = mandantId) ------------ */
  function ladeUnternehmen(mandantId) {
    var m = mid(mandantId);
    return tx(['unternehmen'], 'readonly', function (t) {
      return req(t.objectStore('unternehmen').get(m));
    }).then(function (rec) {
      if (!rec) return null;
      delete rec._id;
      return rec;
    });
  }
  function speichereUnternehmen(obj, mandantId) {
    var m = mid(mandantId);
    var rec = JSON.parse(JSON.stringify(obj || {}));
    rec._id = m; rec.mandantId = m;
    return tx(['unternehmen', 'mandanten', 'meta'], 'readwrite', function (t) {
      t.objectStore('unternehmen').put(rec);
      ensureMandant(t, m, rec.name || rec.firma);
      zaehleAenderung(t);
      return null;
    }).then(function () { delete rec._id; return rec; });
  }
  function loescheUnternehmen(mandantId) {
    var m = mid(mandantId);
    return tx(['unternehmen', 'meta'], 'readwrite', function (t) {
      t.objectStore('unternehmen').delete(m);
      zaehleAenderung(t);
      return null;
    }).then(function () { return true; });
  }

  /* ---- Abschluesse (je Mandant ueber Index 'mandantId') ---------------- */
  function listeAbschluesse(mandantId) {
    var m = mid(mandantId);
    return tx(['abschluesse'], 'readonly', function (t) {
      return req(t.objectStore('abschluesse').index('mandantId')
        .getAll(IDBKeyRange.only(m)));
    }).then(function (l) {
      return (l || []).sort(function (a, b) {
        return (a.stichtag || '').localeCompare(b.stichtag || '');
      });
    });
  }
  function ladeAbschluss(id, mandantId) {
    var m = mid(mandantId);
    return tx(['abschluesse'], 'readonly', function (t) {
      return req(t.objectStore('abschluesse').get(String(id)));
    }).then(function (a) {
      if (!a) return null;
      /* Schutz: nur Abschluesse des aktiven Mandanten herausgeben. Alt-Saetze
       * ohne mandantId gelten als 'standard'. */
      if ((a.mandantId || STD) !== m) return null;
      return a;
    });
  }
  function speichereAbschluss(obj, mandantId) {
    var m = mid(mandantId);
    var rec = JSON.parse(JSON.stringify(obj || {}));
    if (!rec.id) rec.id = 'A-' + Date.now();
    rec.mandantId = m;
    rec.geaendertAm = new Date().toISOString();
    return tx(['abschluesse', 'mandanten', 'meta'], 'readwrite', function (t) {
      t.objectStore('abschluesse').put(rec);
      ensureMandant(t, m);
      zaehleAenderung(t);
      return null;
    }).then(function () { return rec; });
  }
  function loescheAbschluss(id, mandantId) {
    var m = mid(mandantId);
    return tx(['abschluesse', 'meta'], 'readwrite', function (t) {
      var s = t.objectStore('abschluesse');
      s.get(String(id)).onsuccess = function (e) {
        var a = e.target.result;
        if (a && (a.mandantId || STD) === m) s.delete(String(id));
      };
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

  /* ---- Snapshot (Voll-Export/Import ueber ALLE Mandanten) -------------- */
  /* Voll-Backup: enthaelt JEDEN Mandanten + dessen Daten (sonst Datenverlust
   * beim Restore). Form v2: { version:2, mandanten:[], unternehmen:[], abschluesse:[] }. */
  function leseSnapshot() {
    return offen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(['mandanten', 'unternehmen', 'abschluesse'], 'readonly');
        var out = { version: 2, mandanten: [], unternehmen: [], abschluesse: [] };
        t.objectStore('mandanten').getAll().onsuccess = function (e) { out.mandanten = e.target.result || []; };
        t.objectStore('unternehmen').getAll().onsuccess = function (e) {
          out.unternehmen = (e.target.result || []).map(function (u) {
            var c = JSON.parse(JSON.stringify(u));
            if (!c.mandantId) c.mandantId = c._id || STD;
            delete c._id; return c;
          });
        };
        t.objectStore('abschluesse').getAll().onsuccess = function (e) { out.abschluesse = e.target.result || []; };
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transaktion abgebrochen')); };
      });
    });
  }
  /* Import: normalisiert JEDE Form (alte v1-Sicherung {unternehmen:obj,
   * abschluesse:[]} ODER v2) ueber die getestete Transform -> v2, dann atomar
   * alle Stores ersetzen. */
  function schreibeSnapshot(snap) {
    var v2 = Transform.migriere(snap || {});
    return tx(['unternehmen', 'abschluesse', 'mandanten', 'meta'], 'readwrite', function (t) {
      t.objectStore('unternehmen').clear();
      t.objectStore('abschluesse').clear();
      t.objectStore('mandanten').clear();
      (v2.mandanten || []).forEach(function (m) { t.objectStore('mandanten').put(m); });
      (v2.unternehmen || []).forEach(function (u) {
        var rec = JSON.parse(JSON.stringify(u));
        rec._id = rec.mandantId || STD;
        t.objectStore('unternehmen').put(rec);
      });
      var sa = t.objectStore('abschluesse');
      (v2.abschluesse || []).forEach(function (a) {
        var rec = JSON.parse(JSON.stringify(a));
        if (!rec.mandantId) rec.mandantId = STD;
        sa.put(rec);
      });
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
    listeMandanten: listeMandanten, speichereMandant: speichereMandant,
    loescheMandant: loescheMandant,
    ladeUnternehmen: ladeUnternehmen, speichereUnternehmen: speichereUnternehmen,
    loescheUnternehmen: loescheUnternehmen,
    listeAbschluesse: listeAbschluesse, ladeAbschluss: ladeAbschluss,
    speichereAbschluss: speichereAbschluss, loescheAbschluss: loescheAbschluss,
    leseSnapshot: leseSnapshot, schreibeSnapshot: schreibeSnapshot,
    backupStatus: backupStatus, markiereExport: markiereExport,
    getMeta: getMeta, setMeta: setMeta
  };
});
