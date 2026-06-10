/* ===========================================================================
 * ausgangsrechnung.js  -  Helfer für ausgehende Rechnungen
 * ---------------------------------------------------------------------------
 * Bündelt die Cross-Cutting-Logik, die Stammdaten, Editor und Renderer
 * gemeinsam brauchen:
 *
 *   defaults(unternehmen)            sichere Default-Strukturen für fehlende
 *                                    Stammdatenfelder (rechnungsAngaben,
 *                                    rechnungsnummern, kunden, …)
 *   eigeneAusUnternehmen(u)          aus Unternehmensdaten die effektiven
 *                                    Rechnungs-Eigen-Angaben ableiten
 *                                    (rechnungsAngaben hat Vorrang vor den
 *                                    Hauptfeldern)
 *   naechsteNummer(u, datum)         lückenlose nächste Rechnungsnummer aus
 *                                    dem Schema. Mutiert u.rechnungsnummern
 *                                    NICHT — Vergabe geschieht erst beim
 *                                    Festschreiben (s. vergebeNummer).
 *   vergebeNummer(u, datum)          tatsächlicher Vergabevorgang (mutiert)
 *   buchungenAusRechnung(r, idStamp) Buchungssatz/-sätze (Forderung, USt,
 *                                    optional § 13b) für eine versendete
 *                                    Rechnung
 *
 * Steuerlogik konsistent zu xrechnung-ubl.js (STEUERLOGIK).
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ausgangsrechnung = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* SKR04-Konten, die der Buchungsautomat verwendet. Wir bleiben strikt
   * auf konservativen, weit verbreiteten Standardkonten — keine Spezialfälle. */
  var KTO = {
    forderung:        '1200',  /* Bank — wird beim Versand auf Forderung umgehängt; */
                               /* tatsächlich: 1200 = Forderungen aLuL (SKR04) */
    forderungLuL:     '1200',  /* Forderungen aus Lieferungen und Leistungen */
    erloese19:        '4400',  /* Erlöse 19 % USt */
    erloese7:         '4300',  /* Erlöse 7 % USt */
    erloeseSteuerfrei:'4180',  /* Steuerfreie Erlöse § 4 Nr. 1 b (innergem. Lieferung) */
    erloese13b:       '4336',  /* Steuerschuldnerschaft des Leistungsempfängers */
    ust19:            '3806',  /* Umsatzsteuer 19 % (SKR04) */
    ust7:             '3801'   /* Umsatzsteuer 7 % (SKR04) */
  };

  function num(s) {
    var t = String(s == null ? '' : s).replace(/\s/g, '');
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '');   // "1.234,56" -> "1234,56"
    var n = parseFloat(t.replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function cent(n) { return Math.round((num(n) + Number.EPSILON) * 100) / 100; }

  function defaults(u) {
    var d = u || {};
    if (!d.kunden)         d.kunden = [];
    if (!d.rechnungsnummern) d.rechnungsnummern = { schema: 'RE-{JAHR}-{NR:04}',
                                                     naechste: 1, jahr: 0 };
    if (!d.rechnungsAngaben) d.rechnungsAngaben = {};
    return d;
  }
  function eigeneAusUnternehmen(u) {
    var d = defaults(u);
    var r = d.rechnungsAngaben || {};
    return {
      name:            r.name            || d.name            || '',
      strasse:         r.strasse         || d.strasse         || '',
      plz:             r.plz             || d.plz             || '',
      ort:             r.ort             || d.ort             || '',
      land:            r.land            || 'DE',
      stNr:            r.stNr            || d.steuernummer    || '',
      ustId:           r.ustId           || d.wirtschaftsidnr || '',
      registergericht: r.registergericht || d.registergericht || '',
      hrNummer:        r.hrNummer        || d.hrNummer        || '',
      ansprechpartner: r.ansprechpartner || (d.geschaeftsfuehrer || [])[0] || '',
      telefon:         r.telefon         || '',
      email:           r.email           || '',
      bank:            r.bank            || {}
    };
  }
  /* Schema-Platzhalter ersetzen. Unterstützt {JAHR} und {NR[:<breite>]}. */
  function formatNummer(schema, jahr, nr) {
    var s = String(schema || 'RE-{JAHR}-{NR:04}');
    s = s.replace(/\{JAHR\}/g, String(jahr));
    s = s.replace(/\{NR(?::(\d+))?\}/g, function (_, breite) {
      var b = parseInt(breite, 10) || 0;
      var str = String(nr);
      while (str.length < b) str = '0' + str;
      return str;
    });
    return s;
  }
  function jahrAus(datum) {
    var m = /^(\d{4})/.exec(String(datum || ''));
    return m ? parseInt(m[1], 10) : new Date().getFullYear();
  }
  /* Liefert die nächste freie Rechnungsnummer für das gegebene Datum, OHNE
   * den Zähler zu mutieren — für Vorschauen im Editor. */
  function naechsteNummer(u, datum) {
    var d = defaults(u);
    var rn = d.rechnungsnummern;
    var j = jahrAus(datum);
    var nr = (rn.jahr === j) ? rn.naechste : 1;
    return formatNummer(rn.schema, j, nr);
  }
  /* Tatsächlicher Vergabevorgang: Zähler weiterstellen, neue Nummer
   * zurückgeben. Stellt Jahreswechsel um. */
  function vergebeNummer(u, datum) {
    var d = defaults(u);
    var rn = d.rechnungsnummern;
    var j = jahrAus(datum);
    if (rn.jahr !== j) { rn.jahr = j; rn.naechste = 1; }
    var nummer = formatNummer(rn.schema, j, rn.naechste);
    rn.naechste = (rn.naechste || 1) + 1;
    return nummer;
  }
  /* Wählt das passende Erlös-/USt-Konto für eine Position abhängig von der
   * Steuerlogik der Rechnung und vom Steuersatz der Position. */
  function konten(besonderheit, ustSatz) {
    if (besonderheit === 'REVERSE_CHARGE_13b' || besonderheit === 'INNERGEM_LEISTUNG') {
      return { erlos: KTO.erloese13b, ust: null };
    }
    if (besonderheit === 'INNERGEM_LIEFERUNG' || besonderheit === 'STEUERFREI_§4') {
      return { erlos: KTO.erloeseSteuerfrei, ust: null };
    }
    if (besonderheit === 'KLEINUNTERNEHMER_19') {
      return { erlos: KTO.erloese19, ust: null };
    }
    /* NORMAL: Satz entscheidet. 19 → 4400/3806; 7 → 4300/3801. */
    if (Math.abs(num(ustSatz) - 7) < 0.001) {
      return { erlos: KTO.erloese7, ust: KTO.ust7 };
    }
    return { erlos: KTO.erloese19, ust: KTO.ust19 };
  }
  /* Erzeugt die Buchungssätze für eine Ausgangsrechnung. Pro Erlöskonto/Satz
   * eine eigene Buchung (Forderung an Erlös) + eine USt-Buchung gegen die
   * Forderung. So bleibt die Aufteilung im Buchungsjournal sichtbar.
   *
   * Rückgabe: Array von Buchungs-Objekten (id, datum, soll, haben, betrag,
   * text), die der Aufrufer direkt in a.buchungen pushen kann. */
  function buchungenAusRechnung(r, idStamp) {
    var stamp = String(idStamp || Date.now());
    var out = [];
    /* Pro Satz das Mengengerüst zusammenrechnen. */
    var perSatz = {};
    (r.positionen || []).forEach(function (p) {
      var n = cent(num(p.menge) * num(p.einzelpreis));
      var satz = num(p.ustSatz);
      var k = String(satz);
      if (!perSatz[k]) perSatz[k] = { satz: satz, netto: 0 };
      perSatz[k].netto = cent(perSatz[k].netto + n);
    });
    var bes = r.besonderheit || 'NORMAL';
    var standard = (bes === 'NORMAL');
    /* Für Sonderfälle alles auf einen 0-%-Block zusammenkippen — die
     * Aufteilung nach Position ist dort steuerlich irrelevant. */
    if (!standard) {
      var summe = 0;
      Object.keys(perSatz).forEach(function (k) { summe = cent(summe + perSatz[k].netto); });
      perSatz = { '0': { satz: 0, netto: summe } };
    }
    var i = 0;
    Object.keys(perSatz).forEach(function (k) {
      var g = perSatz[k];
      var kk = konten(bes, g.satz);
      var ust = cent(g.netto * (standard ? g.satz / 100 : 0));
      var textBase = 'Ausgangsrechnung ' + (r.nummer || '') +
        ((r.kundeSnapshot && r.kundeSnapshot.name) ? ' ' + r.kundeSnapshot.name : '');
      /* Forderung an Erlös (netto). */
      out.push({
        id: 'B-AR-' + stamp + '-' + (i++),
        datum: r.datum,
        soll: KTO.forderungLuL,
        haben: kk.erlos,
        betrag: g.netto,
        text: (textBase + (standard ? ' (Netto ' + g.satz + '%)' : '')).slice(0, 200)
      });
      if (standard && ust > 0.005 && kk.ust) {
        /* USt-Buchung: zusätzlicher Forderungs-Anteil gegen Umsatzsteuer.
         * Üblicher Brutto-Split: Forderung 119 an Erlös 100 + USt 19. */
        out.push({
          id: 'B-AR-' + stamp + '-' + (i++),
          datum: r.datum,
          soll: KTO.forderungLuL,
          haben: kk.ust,
          betrag: ust,
          text: (textBase + ' (USt ' + g.satz + '%)').slice(0, 200)
        });
      }
    });
    return out;
  }

  return {
    KONTEN: KTO,
    defaults: defaults,
    eigeneAusUnternehmen: eigeneAusUnternehmen,
    naechsteNummer: naechsteNummer,
    vergebeNummer: vergebeNummer,
    buchungenAusRechnung: buchungenAusRechnung,
    formatNummer: formatNummer
  };
});
