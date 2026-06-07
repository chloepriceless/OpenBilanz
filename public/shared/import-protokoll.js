/* ===========================================================================
 * import-protokoll.js  -  Importprotokoll: nachvollziehbarer Eintrag je Import
 * ---------------------------------------------------------------------------
 * Reine, seiteneffektfreie Logik, die aus einem Parser-Ergebnis (Bank-, DATEV-
 * oder Broker-Import) einen Protokolleintrag baut. Der Eintrag dokumentiert
 * GoBD-konform, WAS WANN aus WELCHER Quelle übernommen wurde:
 *   { format, zeit, anzahlErkannt, anzahlUebernommen, anzahlUebersprungen,
 *     datumsbereich:{von,bis}|null, dateiname?, dateiHash? }
 *
 * Die UI (app.js) ruft diese Funktionen beim Übernehmen eines Imports auf und
 * hängt den Eintrag an a.importLog an. Hier liegt nur die testbare Kernlogik:
 *   eintrag(format, parsed, opt)   baut einen Eintrag (Zeit injizierbar)
 *   datumsbereich(eintraege)       min/max über gültige ISO-Daten (YYYY-MM-DD)
 *   eintraegeAus(parsed)           normalisiert {tx} / {buchungen} / Array
 *   anhaengen(protokoll, e, max)   immutables Voranstellen + Längenbegrenzung
 *   istWiederholung(protokoll, h)  Re-Import-Erkennung über Datei-Hash
 *
 * Alle Parser liefern datum als 'YYYY-MM-DD' (oder leer). ISO-Daten sortieren
 * lexikalisch = chronologisch, daher String-Vergleich für min/max.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImportProtokoll = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

  /* Normalisiert verschiedene Parser-Ergebnisse auf die Eintragsliste:
   * CAMT/MT940/Broker liefern { tx: [...] }, DATEV { buchungen: [...] }.
   * Ein direkt übergebenes Array wird unverändert genutzt. */
  function eintraegeAus(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed !== 'object') return [];
    if (Array.isArray(parsed.tx)) return parsed.tx;
    if (Array.isArray(parsed.buchungen)) return parsed.buchungen;
    return [];
  }

  /* Datumsbereich aus einer Eintragsliste: min/max über gültige ISO-Daten.
   * Leere/ungültige Datumsangaben werden ignoriert. Liefert null, wenn kein
   * einziges gültiges Datum vorhanden ist. */
  function datumsbereich(eintraege) {
    var von = null, bis = null;
    (eintraege || []).forEach(function (e) {
      var d = (e && typeof e.datum === 'string') ? e.datum.slice(0, 10) : '';
      if (!ISO_DATUM.test(d)) return;
      if (von === null || d < von) von = d;
      if (bis === null || d > bis) bis = d;
    });
    return von ? { von: von, bis: bis } : null;
  }

  /* Baut einen Importprotokoll-Eintrag. Reine Funktion ohne Seiteneffekt.
   *   format            Label, z. B. 'CAMT.053' | 'MT940' | 'DATEV' | 'Broker'
   *   parsed            Parser-Ergebnis ({tx}/{buchungen}) oder Eintragsliste
   *   opt.zeit          ISO-Zeitstempel (Default: jetzt) — injizierbar für Tests
   *   opt.uebernommen   Anzahl tatsächlich ins Journal übernommener Buchungen
   *                     (Default: alle erkannten Einträge)
   *   opt.uebersprungen Anzahl übersprungener Einträge (z. B. Duplikate, Default 0)
   *   opt.dateiname     optionaler Dateiname als Quelle
   *   opt.dateiHash     optionaler SHA-256 der Quelldatei (Re-Import-Erkennung)
   */
  function eintrag(format, parsed, opt) {
    opt = opt || {};
    var eintraege = eintraegeAus(parsed);
    var erkannt = eintraege.length;
    var uebernommen = (typeof opt.uebernommen === 'number' && opt.uebernommen >= 0)
      ? opt.uebernommen : erkannt;
    var uebersprungen = (typeof opt.uebersprungen === 'number' && opt.uebersprungen >= 0)
      ? opt.uebersprungen : 0;
    var e = {
      format: String(format || 'Unbekannt'),
      zeit: opt.zeit || new Date().toISOString(),
      anzahlErkannt: erkannt,
      anzahlUebernommen: uebernommen,
      anzahlUebersprungen: uebersprungen,
      datumsbereich: datumsbereich(eintraege)
    };
    if (opt.dateiname) e.dateiname = String(opt.dateiname);
    if (opt.dateiHash) e.dateiHash = String(opt.dateiHash);
    return e;
  }

  /* Hängt einen Eintrag VORNE an ein (ggf. neues) Protokoll-Array an (jüngste
   * zuerst) und begrenzt die Länge. Mutiert das Eingabe-Array NICHT. */
  function anhaengen(protokoll, e, maxLen) {
    var arr = Array.isArray(protokoll) ? protokoll.slice() : [];
    arr.unshift(e);
    var grenze = (typeof maxLen === 'number' && maxLen > 0) ? maxLen : 200;
    return arr.slice(0, grenze);
  }

  /* Re-Import-Erkennung: ist diese Datei-Hash schon im Protokoll vermerkt?
   * Leerer/fehlender Hash -> false (keine Aussage möglich). */
  function istWiederholung(protokoll, dateiHash) {
    if (!dateiHash) return false;
    return (protokoll || []).some(function (e) {
      return e && e.dateiHash === dateiHash;
    });
  }

  return {
    eintraegeAus: eintraegeAus,
    datumsbereich: datumsbereich,
    eintrag: eintrag,
    anhaengen: anhaengen,
    istWiederholung: istWiederholung
  };
});
