/* ===========================================================================
 * closing.js  -  Jahresabschluss-Readiness-Pruefung
 * ---------------------------------------------------------------------------
 * Vor dem "Feststellen lassen" eines Jahresabschlusses gibt es eine Reihe
 * typischer Pruefungen. Dieses Modul liefert sie als strukturierte Liste mit
 * OK/Hinweis-Status, damit OpenBilanz dem Nutzer ein klares Bild vermittelt,
 * was bereits da ist und was noch fehlt.
 *
 * pruefeJaReadiness(abschluss) -> [{ titel, status, detail, paragraph?, sprung? }]
 *   status: 'ok' | 'offen' | 'info'
 *
 * Die Pruefungen arbeiten ausschliesslich mit Daten, die in OpenBilanz vorliegen
 * (keine externen Bankauszuege etc.). Sie sind als Erinnerungsstuetze gedacht,
 * nicht als Ersatz fuer die fachliche Schlussbearbeitung.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Closing = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hatKonto(buchungen, nr, modus) {
    return (buchungen || []).some(function (b) {
      if (b.storniert) return false;
      if (modus === 'soll') return b.soll === nr;
      if (modus === 'haben') return b.haben === nr;
      return b.soll === nr || b.haben === nr;
    });
  }

  function summeKonto(buchungen, nr) {
    var s = 0, h = 0;
    (buchungen || []).forEach(function (b) {
      if (b.storniert) return;
      if (b.soll === nr) s += +b.betrag || 0;
      if (b.haben === nr) h += +b.betrag || 0;
    });
    return { soll: s, haben: h, saldo: s - h };
  }

  function pruefeJaReadiness(a) {
    var l = [], b = a && a.buchungen || [];
    var anlagen = (a && a.anlagen) || [];

    // 1. Anfangsbestaende uebernommen (mindestens eine 9000-Buchung)
    var hatEbk = hatKonto(b, '9000');
    l.push({
      titel: 'Anfangsbestände übernommen',
      status: hatEbk ? 'ok' : 'offen',
      detail: hatEbk
        ? 'Eröffnungsbuchungen gegen Konto 9000 vorhanden.'
        : 'Keine Buchungen gegen das Eröffnungsbilanzkonto 9000. Anfangsbestände aus dem ' +
          'Vorjahresabschluss übernehmen (Karte „Anfangsbestände" in der Buchhaltung).',
      paragraph: '§ 252 Abs. 1 Nr. 1 HGB',
      sprung: { view: 'buchhaltung' }
    });

    // 2. AfA gebucht (wenn Anlagenverzeichnis vorhanden, aber keine AfA-Konten bebucht)
    var hatAnlagen = anlagen.length > 0;
    var afaKonten = ['6200', '6220', '6221', '6260', '7210'];
    var hatAfA = afaKonten.some(function (k) { return hatKonto(b, k); });
    l.push({
      titel: 'AfA gebucht',
      status: !hatAnlagen ? 'info' : (hatAfA ? 'ok' : 'offen'),
      detail: !hatAnlagen
        ? 'Kein Anlagenverzeichnis - keine AfA notwendig.'
        : hatAfA
          ? 'Mindestens ein AfA-Konto wurde bebucht (6200/6220/6221/6260/7210).'
          : 'Anlagenverzeichnis vorhanden, aber kein AfA-Konto bebucht. „AfA-Buchungen ' +
            'übernehmen" im Anlagenverzeichnis nutzen.',
      paragraph: '§ 253 Abs. 3 HGB',
      sprung: { view: 'anlagen' }
    });

    // 3. Steuerrueckstellungen oder Steueraufwand erfasst (gilt nur bei Gewinn)
    var ergebnisSchaetz = 0;
    // Ergebnis = Summe Ertragskonten (4xxx, 7000-7100) - Summe Aufwandskonten (5xxx, 6xxx, 7200+)
    // Sehr grob — wir nutzen nur a.werte.guv-Aggregat, wenn vorhanden.
    if (a && a.werte && a.werte.guv) {
      var gw = a.werte.guv;
      Object.keys(gw).forEach(function (k) { ergebnisSchaetz += +gw[k] || 0; });
    }
    var hatStRueckstellung = hatKonto(b, '3020') || hatKonto(b, '3030') || hatKonto(b, '3040');
    var hatStAufwand = hatKonto(b, '7600') || hatKonto(b, '7608') || hatKonto(b, '7610');
    l.push({
      titel: 'Steuerrückstellungen / Ertragsteuern erfasst',
      status: (hatStRueckstellung || hatStAufwand) ? 'ok' : 'offen',
      detail: (hatStRueckstellung || hatStAufwand)
        ? 'Steueraufwand und/oder -rückstellung sind im Journal.'
        : 'Bei einem Gewinn sind Körperschaftsteuer, Soli und Gewerbesteuer zu erfassen ' +
          '(Konten 7600/7608/7610) oder als Rückstellung zu bilden (3020/3030/3040).',
      paragraph: '§ 249 Abs. 1 HGB · § 246 HGB',
      sprung: { view: 'steuer' }
    });

    // 4. Periodenabgrenzungen geprueft (User-Erinnerung, keine harte Pruefung)
    var hatARA = hatKonto(b, '1900');
    var hatPRA = hatKonto(b, '3900');
    l.push({
      titel: 'Rechnungsabgrenzung geprüft',
      status: 'info',
      detail: (hatARA || hatPRA)
        ? 'Bereits Rechnungsabgrenzungs-Buchungen vorhanden ' +
          '(' + (hatARA ? '1900' : '') + (hatARA && hatPRA ? ' · ' : '') +
          (hatPRA ? '3900' : '') + ').'
        : 'Hat das Geschäftsjahr Aufwendungen oder Erträge für die Folgeperiode (z. B. ' +
          'Mietvorauszahlung, Versicherung)? Dann auf 1900 / 3900 abgrenzen.',
      paragraph: '§ 250 HGB'
    });

    // 5. Buchungen festgeschrieben (GoBD - § 146 AO)
    var offen = b.filter(function (x) { return !x.fest; }).length;
    l.push({
      titel: 'Buchungen festgeschrieben',
      status: b.length && offen === 0 ? 'ok' : 'offen',
      detail: !b.length
        ? 'Noch keine Buchungen erfasst.'
        : offen === 0
          ? 'Alle ' + b.length + ' Buchungen sind festgeschrieben.'
          : offen + ' von ' + b.length + ' Buchungen sind noch nicht festgeschrieben. ' +
            'Vor dem Abschluss in der Buchhaltung „Buchungen festschreiben".',
      paragraph: '§ 146 AO',
      sprung: { view: 'buchhaltung' }
    });

    // 6. Bilanz ausgeglichen (kommt aus dem Rechenkern, nicht aus den Buchungen direkt)
    if (a && a.werte) {
      // Wir koennen hier ohne Berechnung-Import nichts hartes pruefen - status info
      l.push({
        titel: 'Bilanz ausgeglichen',
        status: 'info',
        detail: 'Live im Editor-Status angezeigt - rote Statusbox = Aktiva ≠ Passiva.',
        sprung: { view: 'editor' }
      });
    }

    return l;
  }

  return { pruefeJaReadiness: pruefeJaReadiness, summeKonto: summeKonto, hatKonto: hatKonto };
});
