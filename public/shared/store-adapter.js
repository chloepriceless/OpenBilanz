/* ===========================================================================
 * store-adapter.js  -  Persistenz-Abstraktion (Dual-Mode, mandantenfaehig)
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
 * MEHRMANDANTEN (Welle 7): der Adapter haelt einen AKTIVEN Mandanten (Default
 * 'standard') und reicht ihn transparent an das Backend durch - die meisten
 * app.js-Aufrufstellen bleiben dadurch unveraendert. setMandant/getMandant +
 * listeMandanten/mandantAnlegen steuern die Auswahl. Voll-Export/Import
 * (leseSnapshot/schreibeSnapshot) bleiben mandantenuebergreifend (Voll-Backup).
 *
 * Beide Adapter erfuellen denselben Vertrag (alle Methoden geben ein Promise):
 *   ladeState()                 -> { unternehmen, abschluesse:[Kurzinfo],
 *                                    mandanten:[], aktiverMandant }
 *   setMandant(id) / getMandant()
 *   listeMandanten()            -> [{id,name,angelegtAm}]
 *   mandantAnlegen(name)        -> { ok, id, ... }
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

  var STD = (root.MandantenMigration && root.MandantenMigration.STANDARD_ID) || 'standard';

  function jfetch(p, opt) {
    return fetch(p, opt).then(function (r) {
      return r.json().then(function (j) { return j; }, function () { return {}; });
    });
  }
  function kurzinfo(a) {
    return { id: a.id, art: a.art, bezeichnung: a.bezeichnung, stichtag: a.stichtag,
             groessenklasse: a.groessenklasse, status: a.status };
  }
  /* mandantId -> dateisicherer/URL-tauglicher Schluessel (analog lib/store.js). */
  function sicher(id) {
    var s = String(id == null ? '' : id).replace(/[^A-Za-z0-9_.\-]/g, '_');
    return s || STD;
  }

  /* ---- Selbst-Hosting-Modus: spricht die Node-JSON-API an -------------- */
  function FetchAdapter() {
    var aktiv = STD;
    function mq() { return 'mandant=' + encodeURIComponent(aktiv); }
    var self = {
      modus: 'selfhost',
      unterstuetztExport: false,
      get aktiverMandant() { return aktiv; },
      setMandant: function (id) { aktiv = sicher(id); return aktiv; },
      getMandant: function () { return aktiv; },
      listeMandanten: function () {
        return jfetch('/api/mandanten').then(function (r) { return (r && r.mandanten) || []; });
      },
      mandantAnlegen: function (name, id) {
        return jfetch('/api/mandanten', { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, id: id }) });
      },
      ladeState: function () { return jfetch('/api/state?' + mq()); },
      speichereUnternehmen: function (o) {
        return jfetch('/api/unternehmen?' + mq(), { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
      },
      ladeAbschluss: function (id) {
        return jfetch('/api/abschluss?id=' + encodeURIComponent(id) + '&' + mq())
          .then(function (a) { return (a && a.fehler) ? null : a; });
      },
      speichereAbschluss: function (o) {
        return jfetch('/api/abschluss?' + mq(), { method: 'PUT',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
      },
      loescheAbschluss: function (id) {
        return fetch('/api/abschluss?id=' + encodeURIComponent(id) + '&' + mq(), { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function (r) { return !!r.geloescht; });
      },
      loescheUnternehmen: function () {
        return fetch('/api/unternehmen?' + mq(), { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function (r) { return !!r.geloescht; });
      },
      erzeugeXBRL: function (un, ab, form) {
        var q = '/api/xbrl?id=' + encodeURIComponent(ab.id) +
                (form === 'instanz' ? '&form=instanz' : '') + '&' + mq();
        return fetch(q).then(function (r) { return r.text(); }).then(function (xml) {
          return { xml: xml, warnungen: [],
            dateiname: (form === 'instanz' ? 'xbrl-instanz_' : 'ebilanz_') + ab.id + '.xml' };
        });
      },
      validiere: function (un, ab) {
        return jfetch('/api/validate?id=' + encodeURIComponent(ab.id) + '&' + mq());
      }
    };
    return self;
  }

  /* ---- Website-Modus: IndexedDB + XBRL/Validierung im Browser ---------- */
  function IdbAdapter() {
    var S = root.StoreIDB;
    var aktiv = STD;
    return {
      modus: 'website',
      unterstuetztExport: true,
      get aktiverMandant() { return aktiv; },
      setMandant: function (id) { aktiv = sicher(id); return aktiv; },
      getMandant: function () { return aktiv; },
      listeMandanten: function () { return S.listeMandanten(); },
      mandantAnlegen: function (name, id) {
        var neuId = sicher(id || name || ('m-' + Date.now()));
        return S.listeMandanten().then(function (liste) {
          if ((liste || []).some(function (m) { return m && m.id === neuId; })) {
            return { ok: false, grund: 'existiert', id: neuId };
          }
          return S.speichereMandant({ id: neuId, name: name || neuId })
            .then(function () { return { ok: true, id: neuId }; });
        });
      },
      ladeState: function () {
        return Promise.all([
          S.ladeUnternehmen(aktiv), S.listeAbschluesse(aktiv), S.listeMandanten()
        ]).then(function (r) {
          return {
            unternehmen: r[0] || null,
            abschluesse: (r[1] || []).map(kurzinfo),
            mandanten: r[2] || [],
            aktiverMandant: aktiv
          };
        });
      },
      speichereUnternehmen: function (o) { return S.speichereUnternehmen(o, aktiv); },
      ladeAbschluss: function (id) { return S.ladeAbschluss(id, aktiv); },
      speichereAbschluss: function (o) { return S.speichereAbschluss(o, aktiv); },
      loescheAbschluss: function (id) { return S.loescheAbschluss(id, aktiv); },
      loescheUnternehmen: function () { return S.loescheUnternehmen(aktiv); },
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
      /* Browser-spezifisch: Voll-Snapshot (mandantenuebergreifend), Backup, Meta */
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
