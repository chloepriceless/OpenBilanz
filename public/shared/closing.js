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

  /* Storno-Konvention: ein Storno besteht aus dem Original (storniert: true)
   * UND der Gegenbuchung (stornoVon gesetzt). Beide zusammen heben sich auf -
   * wer nur eine Seite ueberspringt, verfaelscht Salden und Treffer. Daher
   * werden hier BEIDE Seiten ignoriert. */
  function stornoPaar(b) { return !!(b.storniert || b.stornoVon); }

  function hatKonto(buchungen, nr, modus) {
    return (buchungen || []).some(function (b) {
      if (stornoPaar(b)) return false;
      if (modus === 'soll') return b.soll === nr;
      if (modus === 'haben') return b.haben === nr;
      return b.soll === nr || b.haben === nr;
    });
  }

  function summeKonto(buchungen, nr) {
    var s = 0, h = 0;
    (buchungen || []).forEach(function (b) {
      if (stornoPaar(b)) return;
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
        ? 'Kein Anlagenverzeichnis — keine AfA notwendig.'
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
        detail: 'Live im Editor-Status angezeigt — rote Statusbox = Aktiva ≠ Passiva.',
        sprung: { view: 'editor' }
      });
    }

    return l;
  }

  function fmtEur(x) {
    return (Math.round((+x || 0) * 100) / 100).toFixed(2).replace('.', ',');
  }

  /* pruefeUstvaReadiness(buchungen, von, bis, ustva)
   * Closing-Checkliste vor der UStVA-Abgabe (§ 18 UStG). Entkoppelt: das
   * UStVA-Kennzahlen-Ergebnis (Ustva.berechne(...)) wird als Parameter
   * uebergeben, damit dieses Modul ohne Abhaengigkeit auskommt und rein
   * testbar bleibt. Rueckgabe wie pruefeJaReadiness:
   *   [{ titel, status:'ok'|'offen'|'info', detail, paragraph?, sprung? }]
   */
  function pruefeUstvaReadiness(buchungen, von, bis, ustva) {
    var l = [], u = ustva || {};
    var imZeitraum = (buchungen || []).filter(function (b) {
      if (!b || b.storniert) return false;
      var d = b.datum || '';
      if (von && d < von) return false;
      if (bis && d > bis) return false;
      return true;
    });

    // Kleinunternehmer: keine USt -> uebrige Pruefungen entfallen.
    if (u.kleinunternehmer) {
      l.push({
        titel: 'Kleinunternehmer (§ 19 UStG)',
        status: 'info',
        detail: 'Als Kleinunternehmer wird keine Umsatzsteuer ausgewiesen; eine UStVA ist ' +
          'regelmäßig nicht abzugeben. Die übrigen UStVA-Prüfungen entfallen.',
        paragraph: '§ 19 UStG'
      });
      return l;
    }

    // 1. Keine offenen (nicht festgeschriebenen) Buchungen im Zeitraum (GoBD).
    var offen = imZeitraum.filter(function (x) { return !x.fest; }).length;
    l.push({
      titel: 'Buchungen des Zeitraums festgeschrieben',
      status: !imZeitraum.length ? 'info' : (offen === 0 ? 'ok' : 'offen'),
      detail: !imZeitraum.length
        ? 'Im gewählten Zeitraum sind keine Buchungen vorhanden.'
        : offen === 0
          ? 'Alle ' + imZeitraum.length + ' Buchungen des Zeitraums sind festgeschrieben.'
          : offen + ' von ' + imZeitraum.length + ' Buchungen im Zeitraum sind noch nicht ' +
            'festgeschrieben. Vor der UStVA-Abgabe festschreiben.',
      paragraph: '§ 146 AO',
      sprung: { view: 'buchhaltung' }
    });

    // 2. Gebuchte USt (3806/3801) stimmt mit der aus den Erlösen 19/7 % errechneten USt überein.
    var berechnet = +u.ustBerechnet || 0;
    var gebucht = +u.ustGebucht || 0;
    var diff = Math.round((gebucht - berechnet) * 100) / 100;
    var toleranz = Math.max(1.00, Math.abs(berechnet) * 0.01);   // Rundung über viele Buchungen
    l.push({
      titel: 'Gebuchte USt stimmt mit den Erlösen überein',
      status: Math.abs(diff) <= toleranz ? 'ok' : 'offen',
      detail: Math.abs(diff) <= toleranz
        ? 'Gebuchte USt (3806/3801: ' + fmtEur(gebucht) + ' EUR) entspricht der aus den ' +
          'Erlösen 19/7 % errechneten USt (' + fmtEur(berechnet) + ' EUR).'
        : 'Differenz zwischen gebuchter USt (3806/3801: ' + fmtEur(gebucht) + ' EUR) und aus ' +
          'den Erlösen errechneter USt (' + fmtEur(berechnet) + ' EUR): ' + fmtEur(diff) +
          ' EUR. Mögliche Ursache: falscher Steuerschlüssel, fehlende USt-Buchung oder Erlös ' +
          'ohne Umsatzsteuer.',
      paragraph: '§ 18 UStG',
      sprung: { view: 'ustva' }
    });

    // 3. Vorsteuer plausibel: 1406/1401 sollten einen Soll-Saldo (>= 0) haben.
    var vst = +u.vorsteuerKonten || 0;
    l.push({
      titel: 'Vorsteuer plausibel',
      status: vst >= -0.005 ? 'ok' : 'offen',
      detail: vst >= -0.005
        ? 'Abziehbare Vorsteuer (1406/1401): ' + fmtEur(vst) + ' EUR (Soll-Saldo, plausibel).'
        : 'Die Vorsteuerkonten 1406/1401 haben einen Haben-Überhang (' + fmtEur(vst) + ' EUR). ' +
          'Das ist untypisch — bitte Buchungsrichtung prüfen.',
      paragraph: '§ 15 UStG',
      sprung: { view: 'buchhaltung' }
    });

    // 4. Zahllast / Erstattung (Info-Echo der Kennzahl 83).
    var kz83 = +u.kz83 || 0;
    l.push({
      titel: kz83 >= 0 ? 'Zahllast' : 'Erstattung',
      status: 'info',
      detail: kz83 >= 0
        ? 'Voraussichtliche Zahllast (Kz 83): ' + fmtEur(kz83) + ' EUR ans Finanzamt.'
        : 'Voraussichtlicher Erstattungsanspruch: ' + fmtEur(-kz83) + ' EUR (Kz 83: ' +
          fmtEur(kz83) + ' EUR).',
      sprung: { view: 'ustva' }
    });

    return l;
  }

  return { pruefeJaReadiness: pruefeJaReadiness, pruefeUstvaReadiness: pruefeUstvaReadiness,
           summeKonto: summeKonto, hatKonto: hatKonto };
});
