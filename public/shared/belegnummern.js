/* ===========================================================================
 * belegnummern.js  -  Lueckenanalyse fuer laufende Nummernkreise
 * ---------------------------------------------------------------------------
 * Prueft eine Menge vergebener Belegnummern (z. B. Ausgangsrechnungs-Nummern)
 * auf Vollstaendigkeit. Lueckenlos fortlaufende Rechnungsnummern sind eine
 * Anforderung aus § 14 Abs. 4 Nr. 4 UStG; das Finanzamt wertet Luecken als
 * Indiz fuer nicht erfasste Umsaetze. Diese Pruefung macht Luecken und
 * Dubletten sichtbar, bevor die Betriebspruefung sie findet.
 *
 * Heuristik (schema-frei): die LETZTE Ziffernfolge einer Nummer ist die
 * laufende Nummer, der Teil davor (und ein evtl. nicht-numerischer Suffix
 * dahinter) bildet die "Reihe", nach der gruppiert wird. So gruppiert
 * "RE-2026-0001"/"RE-2026-0002" zusammen und "RE-2025-0007" getrennt -
 * der Jahreswechsel ergibt automatisch eine eigene Reihe, jede mit eigenem
 * 1..n-Zaehler.
 *
 * API:
 *   parse(roh)         -> { reihe, suffix, nummer, breite, roh } | null
 *   analysiere(liste)  -> {
 *      reihen: [ { reihe, suffix, von, bis, anzahl, erwartet,
 *                  luecken:[Strings], lueckenAnzahl, dubletten:[Strings],
 *                  vollstaendig, gekuerzt } ],
 *      luecken:   [Strings],   // flach ueber alle Reihen
 *      dubletten: [Strings],
 *      unparsbar: [Strings],
 *      ok: Boolean             // true = keine Luecken/Dubletten/unparsbaren
 *   }
 *
 * Reine Logik, keine I/O, kein Datum-/Uhr-Bezug.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Belegnummern = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Obergrenze fuer aufgezaehlte Luecken pro Reihe - schuetzt vor
   * pathologischer Ausgabe (eine Nummer 1 und eine Nummer 999999 wuerde sonst
   * fast eine Million Strings erzeugen). Wird die Grenze erreicht, liefert die
   * Reihe gekuerzt=true und nur die ersten MAX_LUECKEN fehlenden Nummern. */
  var MAX_LUECKEN = 1000;

  /* Zerlegt eine Belegnummer in (reihe)(nummer)(suffix). reihe ist alles bis
   * zur letzten Ziffernfolge, suffix ein evtl. nicht-numerischer Rest danach. */
  function parse(roh) {
    var s = String(roh == null ? '' : roh).trim();
    if (!s) return null;
    // (.*\D|) = alles bis zur letzten Ziffernfolge (endend auf Nicht-Ziffer)
    //           ODER leer; (\d+) = die laufende Nummer; (\D*) = Suffix.
    var m = /^(.*\D|)(\d+)(\D*)$/.exec(s);
    if (!m) return null;            // keine Ziffer enthalten
    return {
      reihe:  m[1],
      suffix: m[3],
      nummer: parseInt(m[2], 10),
      breite: m[2].length,
      roh:    s
    };
  }

  /* Stellt eine Nummer mit fuehrenden Nullen auf die gegebene Breite. */
  function pad(n, breite) {
    var str = String(n);
    while (str.length < breite) str = '0' + str;
    return str;
  }

  function format(reihe, suffix, n, breite) {
    return reihe + pad(n, breite) + suffix;
  }

  function analysiere(liste) {
    var gruppen = {};       // key -> Akkumulator
    var reihenfolge = [];   // stabile Reihenfolge der Reihen-Keys
    var unparsbar = [];

    (liste || []).forEach(function (roh) {
      var p = parse(roh);
      if (!p) {
        if (roh != null && String(roh).trim() !== '') unparsbar.push(String(roh).trim());
        return;
      }
      var key = p.reihe + '\u0000' + p.suffix;
      var g = gruppen[key];
      if (!g) {
        g = gruppen[key] = { reihe: p.reihe, suffix: p.suffix, breite: p.breite, zahlen: {} };
        reihenfolge.push(key);
      }
      if (p.breite > g.breite) g.breite = p.breite;   // breiteste Schreibweise gewinnt
      g.zahlen[p.nummer] = (g.zahlen[p.nummer] || 0) + 1;
    });

    var reihen = [];
    var alleLuecken = [];
    var alleDubletten = [];

    reihenfolge.forEach(function (key) {
      var g = gruppen[key];
      var nums = Object.keys(g.zahlen).map(Number).sort(function (a, b) { return a - b; });
      var von = nums[0];
      var bis = nums[nums.length - 1];

      var dubletten = [];
      nums.forEach(function (n) {
        if (g.zahlen[n] > 1) dubletten.push(format(g.reihe, g.suffix, n, g.breite));
      });

      var luecken = [];
      var lueckenAnzahl = 0;
      var gekuerzt = false;
      var vorhanden = g.zahlen;
      for (var n = von + 1; n < bis; n++) {
        if (!vorhanden[n]) {
          lueckenAnzahl++;
          if (luecken.length < MAX_LUECKEN) luecken.push(format(g.reihe, g.suffix, n, g.breite));
          else gekuerzt = true;
        }
      }

      reihen.push({
        reihe: g.reihe,
        suffix: g.suffix,
        von: von,
        bis: bis,
        anzahl: nums.length,                 // distinkte vergebene Nummern
        erwartet: (bis - von + 1),           // bei Lueckenlosigkeit erwartete Menge
        luecken: luecken,
        lueckenAnzahl: lueckenAnzahl,
        dubletten: dubletten,
        vollstaendig: (lueckenAnzahl === 0 && dubletten.length === 0),
        gekuerzt: gekuerzt
      });

      alleLuecken = alleLuecken.concat(luecken);
      alleDubletten = alleDubletten.concat(dubletten);
    });

    return {
      reihen: reihen,
      luecken: alleLuecken,
      dubletten: alleDubletten,
      unparsbar: unparsbar,
      ok: (alleLuecken.length === 0 && alleDubletten.length === 0 && unparsbar.length === 0)
    };
  }

  return { parse: parse, analysiere: analysiere, format: format, MAX_LUECKEN: MAX_LUECKEN };
});
