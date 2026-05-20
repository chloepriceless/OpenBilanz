/* ===========================================================================
 * healthcheck.js  -  Startseiten-Diagnose
 * ---------------------------------------------------------------------------
 * Liefert eine kurze Liste „passt"/„prüfen"-Hinweise zum aktuellen Datenstand:
 *   - Stammdaten vollstaendig?
 *   - Mindestens ein Abschluss vorhanden?
 *   - Letzte Buchung lange her?
 *   - Backup juenger als x Tage? (Website-Modus, opts.letzteSicherung)
 *
 * pruefe(unternehmen, abschluesse, opts?) -> [{ titel, status, detail }]
 *   status: 'ok' | 'achtung' | 'info'
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HealthCheck = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function tageZwischen(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }
  function parse(d) {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    var p = new Date(String(d));
    return isNaN(p.getTime()) ? null : p;
  }

  function pruefe(unternehmen, abschluesse, opts) {
    opts = opts || {};
    var heute = parse(opts.heute) || new Date();
    var liste = [];

    // 1. Stammdaten vollstaendig (Pflichtfelder fuer den E-Bilanz-Versand)
    var u = unternehmen || {};
    var fehlend = [];
    if (!u.name) fehlend.push('Firmenname');
    if (!u.steuernummer) fehlend.push('Steuernummer');
    if (!u.gruendungsdatum) fehlend.push('Gründungsdatum');
    if (!u.stammkapital && !u.gezeichnetesKapital) fehlend.push('Stammkapital');
    liste.push({
      titel: 'Stammdaten',
      status: fehlend.length ? 'achtung' : 'ok',
      detail: fehlend.length
        ? 'Es fehlen: ' + fehlend.join(', ') + '. (Reiter „Unternehmensdaten")'
        : 'Pflichtfelder gesetzt.'
    });

    // 2. Mindestens ein Abschluss
    var abs = abschluesse || [];
    liste.push({
      titel: 'Abschlüsse',
      status: abs.length ? 'ok' : 'info',
      detail: abs.length
        ? abs.length + ' Abschluss/Abschlüsse vorhanden.'
        : 'Noch kein Abschluss angelegt - mit der Eröffnungsbilanz beginnen.'
    });

    // 3. Letzte Buchung (nur informativ; nutzt opts.letzteBuchung als ISO-Datum)
    if (opts.letzteBuchung) {
      var lb = parse(opts.letzteBuchung);
      if (lb) {
        var tage = tageZwischen(heute, lb);
        liste.push({
          titel: 'Letzte Buchung',
          status: tage > 90 ? 'achtung' : 'ok',
          detail: tage <= 0
            ? 'Heute gebucht.'
            : tage + ' Tage her' + (tage > 90 ? ' - aktuell halten' : '') + '.'
        });
      }
    }

    // 4. Backup-Alter (Website-Modus)
    if (opts.modus === 'website') {
      if (opts.letzteSicherung) {
        var ls = parse(opts.letzteSicherung);
        if (ls) {
          var bTage = tageZwischen(heute, ls);
          liste.push({
            titel: 'Letztes Backup',
            status: bTage > 30 ? 'achtung' : 'ok',
            detail: 'Vor ' + bTage + ' Tagen gesichert' +
              (bTage > 30 ? ' - jetzt sichern empfohlen' : '') + '.'
          });
        }
      } else {
        liste.push({
          titel: 'Letztes Backup',
          status: abs.length ? 'achtung' : 'info',
          detail: abs.length
            ? 'Noch keine .obz-Sicherung erstellt - Sicherung in der Seitenleiste anlegen.'
            : 'Noch nicht relevant - vor dem ersten Abschluss anlegen.'
        });
      }
    }

    return liste;
  }

  return { pruefe: pruefe };
});
