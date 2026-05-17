/* ===========================================================================
 * store-adapter.js  -  Persistenz-Abstraktion (Dual-Mode)
 * ---------------------------------------------------------------------------
 * OpenBilanz laeuft in zwei Betriebsarten aus EINER Codebasis:
 *
 *   selfhost  - node server.js, Datenablage in lokalen JSON-Dateien (data/);
 *               Persistenz und Validierung laufen ueber die Node-API.
 *   website   - rein statisch ausgeliefert, alle Daten im Browser (IndexedDB);
 *               es werden KEINE Daten an einen Server uebertragen.
 *
 * Der Modus steht in window.OPENBILANZ_MODE. Die Vorlage index.html setzt
 * 'website'; server.js schreibt das beim Ausliefern auf 'selfhost' um.
 *
 * Beide Adapter erfuellen denselben Vertrag (alle Methoden geben ein Promise):
 *   ladeState()                 -> { unternehmen, abschluesse:[Kurzinfo] }
 *   speichereUnternehmen(obj)   -> obj
 *   ladeAbschluss(id)           -> abschluss | null
 *   speichereAbschluss(obj)     -> abschluss (mit id, geaendertAm)
 *   loescheAbschluss(id)        -> boolean
 *   erzeugeXBRL(un, ab, form)   -> { xml, warnungen, dateiname }
 *   validiere(un, ab)           -> Pruefergebnis
 * Der IndexedDB-Adapter bietet zusaetzlich leseSnapshot/schreibeSnapshot/
 * backupStatus/markiereExport/getMeta/setMeta fuer Export, Import und Backup.
 * ========================================================================= */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StoreAdapter = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  function jfetch(p, opt) {
    return fetch(p, opt).then(function (r) {
      return r.json().then(function (j) { return j; }, function () { return {}; });
    });
  }
  function kurzinfo(a) {
    return { id: a.id, art: a.art, bezeichnung: a.bezeichnung, stichtag: a.stichtag,
             groessenklasse: a.groessenklasse, status: a.status };
  }

  /* ---- Selbst-Hosting-Modus: spricht die Node-JSON-API an -------------- */
  function FetchAdapter() {
    return {
      modus: 'selfhost',
      unterstuetztExport: false,
      ladeState: function () { return jfetch('/api/state'); },
      speichereUnternehmen: function (o) {
        return jfetch('/api/unternehmen', { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
      },
      ladeAbschluss: function (id) {
        return jfetch('/api/abschluss?id=' + encodeURIComponent(id))
          .then(function (a) { return (a && a.fehler) ? null : a; });
      },
      speichereAbschluss: function (o) {
        return jfetch('/api/abschluss', { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
      },
      loescheAbschluss: function (id) {
        return fetch('/api/abschluss?id=' + encodeURIComponent(id), { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function (r) { return !!r.geloescht; });
      },
      erzeugeXBRL: function (un, ab, form) {
        var q = '/api/xbrl?id=' + encodeURIComponent(ab.id) +
                (form === 'instanz' ? '&form=instanz' : '');
        return fetch(q).then(function (r) { return r.text(); }).then(function (xml) {
          return { xml: xml, warnungen: [],
            dateiname: (form === 'instanz' ? 'xbrl-instanz_' : 'ebilanz_') + ab.id + '.xml' };
        });
      },
      validiere: function (un, ab) {
        return jfetch('/api/validate?id=' + encodeURIComponent(ab.id));
      }
    };
  }

  /* ---- Website-Modus: IndexedDB + XBRL/Validierung im Browser ---------- */
  function IdbAdapter() {
    var S = root.StoreIDB;
    return {
      modus: 'website',
      unterstuetztExport: true,
      ladeState: function () {
        return S.leseSnapshot().then(function (snap) {
          return {
            unternehmen: snap.unternehmen || null,
            abschluesse: (snap.abschluesse || []).map(kurzinfo)
          };
        });
      },
      speichereUnternehmen: function (o) { return S.speichereUnternehmen(o); },
      ladeAbschluss: function (id) { return S.ladeAbschluss(id); },
      speichereAbschluss: function (o) { return S.speichereAbschluss(o); },
      loescheAbschluss: function (id) { return S.loescheAbschluss(id); },
      erzeugeXBRL: function (un, ab, form) {
        var r = (form === 'instanz') ? root.Xbrl.erzeugeXBRL(un || {}, ab)
                                     : root.Xbrl.erzeugeEBilanz(un || {}, ab);
        return Promise.resolve({ xml: r.xml, warnungen: r.warnungen,
          dateiname: (form === 'instanz' ? 'xbrl-instanz_' : 'ebilanz_') +
                     (ab.id || 'abschluss') + '.xml' });
      },
      validiere: function (un, ab) {
        var inst = root.Xbrl.erzeugeXBRL(un || {}, ab);
        return root.BrowserValidate.pruefe(inst.xml, un || {}, ab).then(function (erg) {
          erg.warnungen = (erg.warnungen || []).concat(inst.warnungen || []);
          return erg;
        });
      },
      /* Browser-spezifisch: Voll-Snapshot, Backup-Status, Meta */
      leseSnapshot:   function ()       { return S.leseSnapshot(); },
      schreibeSnapshot: function (snap) { return S.schreibeSnapshot(snap); },
      backupStatus:   function ()       { return S.backupStatus(); },
      markiereExport: function ()       { return S.markiereExport(); },
      getMeta:        function (k)      { return S.getMeta(k); },
      setMeta:        function (k, v)   { return S.setMeta(k, v); }
    };
  }

  /* Waehlt den Adapter anhand des Betriebsmodus. */
  function waehle() {
    var modus = (typeof window !== 'undefined' && window.OPENBILANZ_MODE) || 'website';
    return modus === 'selfhost' ? FetchAdapter() : IdbAdapter();
  }

  return { waehle: waehle, FetchAdapter: FetchAdapter, IdbAdapter: IdbAdapter };
});
