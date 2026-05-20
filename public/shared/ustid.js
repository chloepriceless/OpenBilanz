/* ===========================================================================
 * ustid.js  -  Strukturprüfung für USt-Identifikationsnummern (EU)
 * ---------------------------------------------------------------------------
 *   pruefe(ustid)  ->  { ok, land, normalisiert, fehler?, hinweis? }
 *
 * Prüft:
 *   1. Format (Länderpräfix + erlaubte Längen/Zeichensätze) für alle EU-/EWR-
 *      Staaten + Nordirland (XI).
 *   2. Wo möglich auch die Prüfziffer (DE strikt nach ISO 7064 MOD 11-10;
 *      AT, NL, IT pragmatisch implementiert; übrige Länder bleiben auf
 *      Format-Check beschränkt — das markieren wir in `hinweis`).
 *
 * Ein erfolgreicher Format-Check (ohne implementierte Prüfziffer) wird mit
 * ok=true und `hinweis` zurückgegeben — das UI kann das als „grün mit
 * Wölkchen" anzeigen. Nur eine fehlgeschlagene implementierte Prüfziffer
 * ist ein harter Fehler (ok=false).
 *
 * Reine Strukturprüfung — die qualifizierte Bestätigungsabfrage beim BZSt
 * bzw. VIES erfolgt separat (Server-Modus, Opt-in).
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UstId = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Format-Regex pro Land. Quelle: EU-Kommission, „VAT identification numbers". */
  var FORMAT = {
    AT: /^ATU[0-9]{8}$/,
    BE: /^BE[01][0-9]{9}$/,
    BG: /^BG[0-9]{9,10}$/,
    CY: /^CY[0-9]{8}[A-Z]$/,
    CZ: /^CZ[0-9]{8,10}$/,
    DE: /^DE[0-9]{9}$/,
    DK: /^DK[0-9]{8}$/,
    EE: /^EE[0-9]{9}$/,
    EL: /^EL[0-9]{9}$/,
    ES: /^ES[A-Z0-9][0-9]{7}[A-Z0-9]$/,
    FI: /^FI[0-9]{8}$/,
    FR: /^FR[A-HJ-NP-Z0-9]{2}[0-9]{9}$/,
    HR: /^HR[0-9]{11}$/,
    HU: /^HU[0-9]{8}$/,
    IE: /^IE([0-9]{7}[A-W]|[0-9][A-Z*+][0-9]{5}[A-W]|[0-9]{7}[A-W][A-I])$/,
    IT: /^IT[0-9]{11}$/,
    LT: /^LT([0-9]{9}|[0-9]{12})$/,
    LU: /^LU[0-9]{8}$/,
    LV: /^LV[0-9]{11}$/,
    MT: /^MT[0-9]{8}$/,
    NL: /^NL[0-9]{9}B[0-9]{2}$/,
    PL: /^PL[0-9]{10}$/,
    PT: /^PT[0-9]{9}$/,
    RO: /^RO[0-9]{2,10}$/,
    SE: /^SE[0-9]{12}$/,
    SI: /^SI[0-9]{8}$/,
    SK: /^SK[0-9]{10}$/,
    XI: /^XI([0-9]{9}|[0-9]{12}|HA[0-9]{3}|GD[0-9]{3})$/
  };

  function normalisiere(s) {
    return String(s || '').toUpperCase().replace(/[\s.\-/]+/g, '');
  }

  /* DE-Prüfziffer — ISO 7064 MOD 11-10. Die ersten 9 Ziffern (nach 'DE') sind
   * 8 Stellen Identifikation + 1 Prüfziffer. */
  function pruefeDE(u) {
    var d = u.slice(2);
    if (d.length !== 9) return false;
    var p = 10;
    for (var i = 0; i < 8; i++) {
      var n = parseInt(d.charAt(i), 10);
      var z = (n + p) % 10;
      if (z === 0) z = 10;
      p = (2 * z) % 11;
    }
    var soll = (11 - p) % 10;
    return soll === parseInt(d.charAt(8), 10);
  }

  /* AT-Prüfziffer (ATU + 8 Ziffern). Letzte Ziffer ist Prüfziffer.
   * Algorithmus: Querverknüpfung mit Mustern [1,2,1,2,1,2,1] über die ersten
   * sieben Ziffern; gerade Positionen werden vor der Summenbildung verdoppelt
   * und die Quersumme gebildet (Luhn-Variante).  */
  function pruefeAT(u) {
    var d = u.slice(3);
    if (d.length !== 8) return false;
    var summe = 0;
    for (var i = 0; i < 7; i++) {
      var n = parseInt(d.charAt(i), 10);
      if (i % 2 === 1) {
        var doppelt = n * 2;
        n = (doppelt >= 10) ? (Math.floor(doppelt / 10) + (doppelt % 10)) : doppelt;
      }
      summe += n;
    }
    var prueff = (10 - ((summe + 4) % 10)) % 10;
    return prueff === parseInt(d.charAt(7), 10);
  }

  /* NL-Prüfziffer (NL + 9 Ziffern + B + 2 Ziffern). Die 9 Ziffern vor dem 'B'
   * sind 8 Stellen Identifikation + 1 Prüfziffer. Gewichte 9..2 über die
   * ersten 8 Ziffern, Summe mod 11. Falls Rest > 9, gilt die Nummer als
   * ungültig.  */
  function pruefeNL(u) {
    var d = u.slice(2, 11);
    if (d.length !== 9) return false;
    var summe = 0;
    for (var i = 0; i < 8; i++) {
      summe += parseInt(d.charAt(i), 10) * (9 - i);
    }
    var rest = summe % 11;
    if (rest > 9) return false;
    return rest === parseInt(d.charAt(8), 10);
  }

  /* IT-Prüfziffer (IT + 11 Ziffern, Luhn). */
  function pruefeIT(u) {
    var d = u.slice(2);
    if (d.length !== 11) return false;
    var summe = 0;
    for (var i = 0; i < 11; i++) {
      var n = parseInt(d.charAt(i), 10);
      if ((i + 1) % 2 === 0) {
        n = n * 2;
        if (n > 9) n -= 9;
      }
      summe += n;
    }
    return summe % 10 === 0;
  }

  var IMPLEMENTIERT = { DE: pruefeDE, AT: pruefeAT, NL: pruefeNL, IT: pruefeIT };

  function pruefe(input) {
    var u = normalisiere(input);
    if (!u) return { ok: false, fehler: 'USt-IdNr. ist leer.' };
    var land = u.slice(0, 2);
    var re = FORMAT[land];
    if (!re) {
      return { ok: false, land: land, normalisiert: u,
        fehler: 'Unbekannter Länderpräfix „' + land + '".' };
    }
    if (!re.test(u)) {
      return { ok: false, land: land, normalisiert: u,
        fehler: 'Format passt nicht zur ' + land + '-USt-IdNr. (' + re.source + ').' };
    }
    var fn = IMPLEMENTIERT[land];
    if (!fn) {
      return { ok: true, land: land, normalisiert: u,
        hinweis: 'Format-Check ok — Prüfziffer für ' + land + ' nicht implementiert.' };
    }
    if (!fn(u)) {
      return { ok: false, land: land, normalisiert: u,
        fehler: 'Prüfziffer von ' + land + '-USt-IdNr. „' + u + '" stimmt nicht.' };
    }
    return { ok: true, land: land, normalisiert: u };
  }

  return { pruefe: pruefe, normalisiere: normalisiere,
           LAENDER: Object.keys(FORMAT).sort() };
});
