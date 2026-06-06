/* ===========================================================================
 * mandanten-migration.js  -  Migration einfirmig -> mehrmandantenfaehig
 * ---------------------------------------------------------------------------
 * REINE Transform-Logik (kein I/O, keine Uhr im Vergleich): vervollstaendigt
 * einen beliebigen Datenstand zu einem gueltigen Mehrmandanten-Stand (v2). Der
 * alte, einfirmige Stand (ohne mandantId) bekommt einen automatischen Mandanten
 * "standard"; bestehende mandantId-Zuordnungen bleiben erhalten.
 *
 * Diese Funktion ist bewusst vom IndexedDB-/Datei-I/O getrennt, damit sie ohne
 * Browser testbar und isoliert pruefbar ist (die Migration ist der korrektheits-
 * kritische Punkt von Welle 7; Browser-Datenverlustrisiko im Website-Modus).
 *
 * Vertrag (vom Hub-Refute geschaerft):
 *   - VERVOLLSTAENDIGEND statt ueberspringend: jeder Datensatz erhaelt eine
 *     mandantId. Vorhandene (auch fremde) mandantId wird ERHALTEN, fehlende auf
 *     'standard' gesetzt. So wird ein MITTENDRIN abgebrochener Migrationslauf
 *     (A1 hat schon mandantId, A2 noch nicht) repariert statt still verschluckt
 *     (EDGE1) - kein Datenverlust.
 *   - mandanten[] deckt jede referenzierte mandantId ab; bestehende Mandanten-
 *     Eintraege (Name/angelegtAm) bleiben unveraendert.
 *   - idempotent: ein vollstaendiger v2-Stand kommt unveraendert wieder heraus.
 *   - verlustfrei: keine id geht verloren oder kommt hinzu.
 *   - fresh install (keine Daten) -> leeres v2 ohne Phantom-Mandant.
 *
 * API:
 *   migriere(altSnapshot, opts) -> v2Snapshot
 *   istMigriert(snap) -> Boolean   (vollstaendig migriert?)
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MandantenMigration = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STANDARD_ID = 'standard';

  function klon(o) { return JSON.parse(JSON.stringify(o)); }

  /* Vollstaendig migriert = fuehrt eine Mandantenliste UND jeder Datensatz hat
   * eine mandantId. Ein partiell migrierter Stand (manche Saetze ohne mandantId)
   * gilt NICHT als migriert und wird von migriere() vervollstaendigt. */
  function istMigriert(snap) {
    if (!snap || !Array.isArray(snap.mandanten) || snap.mandanten.length === 0) return false;
    var u = snap.unternehmen;
    var uOk = !u
      || (Array.isArray(u) && u.every(function (x) { return !x || x.mandantId; }))
      || (!Array.isArray(u) && typeof u === 'object' && !!u.mandantId);
    var ab = Array.isArray(snap.abschluesse) ? snap.abschluesse : [];
    var abOk = ab.every(function (x) { return !x || x.mandantId; });
    return uOk && abOk;
  }

  /* migriere(altSnapshot, opts)
   *   altSnapshot: v1 (einfirmig), partiell migriert ODER vollstaendiges v2.
   *   opts.jetzt:  ISO-Zeitstempel fuer NEU angelegte Mandanten (Default: jetzt).
   * Rueckgabe v2: { version:2, mandanten:[...], unternehmen:[...], abschluesse:[...] }
   */
  function migriere(altSnapshot, opts) {
    var jetzt = (opts && opts.jetzt) || new Date().toISOString();
    var snap = altSnapshot ? klon(altSnapshot) : {};

    // --- Unternehmen auf Array-Form mit mandantId normalisieren ---
    var unternehmen = [];
    var uRoh = snap.unternehmen;
    if (Array.isArray(uRoh)) {
      unternehmen = uRoh.filter(Boolean).map(function (u) {
        if (!u.mandantId) u.mandantId = STANDARD_ID;   // fehlende ergaenzen, vorhandene erhalten
        return u;
      });
    } else if (uRoh && typeof uRoh === 'object') {
      if (!uRoh.mandantId) uRoh.mandantId = STANDARD_ID;
      unternehmen = [uRoh];
    }

    // --- Abschluesse: mandantId vervollstaendigen (vorhandene erhalten) ---
    var abschluesse = (Array.isArray(snap.abschluesse) ? snap.abschluesse : [])
      .filter(Boolean).map(function (a) {
        if (!a.mandantId) a.mandantId = STANDARD_ID;
        return a;
      });

    // --- Fresh install: keine Daten -> leeres v2, kein Phantom-Mandant ---
    if (unternehmen.length === 0 && abschluesse.length === 0) {
      return { version: 2, mandanten: [], unternehmen: [], abschluesse: [] };
    }

    // --- mandanten[] aufbauen: bestehende erhalten + referenzierte ergaenzen ---
    var mandanten = (Array.isArray(snap.mandanten) ? snap.mandanten : []).filter(Boolean);
    var bekannt = {};
    mandanten.forEach(function (m) { if (m && m.id != null) bekannt[m.id] = true; });

    function nameFuer(id) {
      if (id === STANDARD_ID) {
        var u = unternehmen.filter(function (x) { return x.mandantId === STANDARD_ID; })[0];
        if (u && (u.name || u.firma)) return String(u.name || u.firma);
        return 'Standard';
      }
      return String(id);   // unbekannte Fremd-mandantId: id als Name (Stub, nicht verwaisen)
    }

    var referenziert = {};
    unternehmen.forEach(function (u) { referenziert[u.mandantId] = true; });
    abschluesse.forEach(function (a) { referenziert[a.mandantId] = true; });
    Object.keys(referenziert).forEach(function (id) {
      if (!bekannt[id]) {
        mandanten.push({ id: id, name: nameFuer(id), angelegtAm: jetzt });
        bekannt[id] = true;
      }
    });

    return {
      version: 2,
      mandanten: mandanten,
      unternehmen: unternehmen,
      abschluesse: abschluesse
    };
  }

  return { migriere: migriere, istMigriert: istMigriert, STANDARD_ID: STANDARD_ID };
});
