/* ===========================================================================
 * mandanten-migration.js  -  Migration einfirmig -> mehrmandantenfaehig
 * ---------------------------------------------------------------------------
 * REINE Transform-Logik (kein I/O, keine Uhr im Vergleich): wandelt einen
 * alten, einfirmigen Datenstand (ohne mandantId) in den neuen Mehrmandanten-
 * Stand um, in dem die bestehenden Daten dem automatisch angelegten Mandanten
 * "standard" zugeordnet werden. Diese Funktion ist bewusst vom IndexedDB- bzw.
 * Datei-I/O getrennt, damit sie ohne Browser testbar ist und isoliert geprueft
 * werden kann (die Migration ist der korrektheitskritische Punkt von Welle 7,
 * Browser-Datenverlustrisiko ohne Server-Backup im Website-Modus).
 *
 * Vertrag:
 *   - idempotent:  bereits migrierter Stand -> unveraendert (Klon) zurueck.
 *   - verlustfrei: jeder Abschluss bleibt erhalten (gleiche id-Menge/Anzahl),
 *                  nur mandantId='standard' wird ergaenzt.
 *   - fresh install (keine Daten) -> leeres v2 ohne Phantom-Mandant.
 *
 * API:
 *   migriere(altSnapshot, opts) -> v2Snapshot
 *   istMigriert(snap) -> Boolean
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MandantenMigration = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STANDARD_ID = 'standard';

  function klon(o) { return JSON.parse(JSON.stringify(o)); }

  /* Ein Stand gilt als migriert, sobald er eine (nicht-leere) Mandantenliste
   * fuehrt - das ist genau das, was migriere() erzeugt. */
  function istMigriert(snap) {
    return !!(snap && Array.isArray(snap.mandanten) && snap.mandanten.length > 0);
  }

  /* migriere(altSnapshot, opts)
   *   altSnapshot v1: { unternehmen: <obj|null>, abschluesse: [<obj>] }
   *               ODER ein bereits migrierter v2-Stand (-> unveraendert).
   *   opts.jetzt:  ISO-Zeitstempel fuer mandant.angelegtAm (Default: jetzt).
   * Rueckgabe v2: { version:2, mandanten:[...], unternehmen:[...], abschluesse:[...] }
   */
  function migriere(altSnapshot, opts) {
    var snap = altSnapshot || {};
    if (istMigriert(snap)) return klon(snap);          // idempotent

    var jetzt = (opts && opts.jetzt) || new Date().toISOString();
    var u = snap.unternehmen || null;
    var abschluesse = Array.isArray(snap.abschluesse) ? snap.abschluesse : [];

    // Fresh install: nichts zu migrieren -> kein Phantom-Mandant.
    if (!u && abschluesse.length === 0) {
      return { version: 2, mandanten: [], unternehmen: [], abschluesse: [] };
    }

    var name = (u && (u.name || u.firma)) ? String(u.name || u.firma) : 'Standard';
    var mandanten = [{ id: STANDARD_ID, name: name, angelegtAm: jetzt }];

    var unternehmen = [];
    if (u) {
      var uc = klon(u);
      uc.mandantId = STANDARD_ID;
      unternehmen.push(uc);
    }

    var neueAbschluesse = abschluesse.map(function (a) {
      var ac = klon(a);
      ac.mandantId = STANDARD_ID;
      return ac;
    });

    return {
      version: 2,
      mandanten: mandanten,
      unternehmen: unternehmen,
      abschluesse: neueAbschluesse
    };
  }

  return { migriere: migriere, istMigriert: istMigriert, STANDARD_ID: STANDARD_ID };
});
