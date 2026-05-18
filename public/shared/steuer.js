/* ===========================================================================
 * steuer.js  -  Überschlägige Steuerberechnung (KSt, Soli, GewSt)
 * ---------------------------------------------------------------------------
 * Berechnet aus dem handelsrechtlichen Jahresergebnis überschlägig die
 * Ertragsteuern einer GmbH - mit den Besonderheiten der VERMOEGENS-
 * VERWALTENDEN GmbH und weiteren Sonderfällen:
 *   - § 8b KStG     Beteiligungserträge/Veräußerungsgewinne 95 % steuerfrei
 *   - § 8b Abs. 4   Streubesitz < 10 % -> Dividende voll körperschaftsteuerpfl.
 *   - § 8 Nr. 5 /   Streubesitz < 15 % -> Dividende gewerbesteuerpflichtig
 *     § 9 Nr. 2a GewStG
 *   - § 9 Nr. 1 GewStG  einfache und erweiterte Grundstücks-Kürzung
 *   - § 8 Nr. 1 GewStG  Hinzurechnung von Finanzierungsanteilen
 *   - § 10d EStG / § 10a GewStG  Verlustvortrag mit Mindestbesteuerung
 *   - § 8 Abs. 3 KStG  verdeckte Gewinnausschüttung
 *
 * WICHTIG: Dies ist eine überschlägige Orientierungsrechnung, KEINE
 * verbindliche Steuerberechnung. Hinzurechnungen/Kürzungen nach §§ 8/9 GewStG
 * sind nur teilweise abgebildet. Im Zweifel Steuerberater hinzuziehen.
 *
 * Sätze: KSt 15 % bis VZ 2027, danach stufenweise Absenkung (14 % 2028 …
 * 10 % ab 2032) nach dem steuerlichen Investitionssofortprogramm 2025;
 * Soli 5,5 % auf die KSt, GewSt-Steuermesszahl 3,5 % (§ 11 GewStG).
 * Kapitalgesellschaften haben KEINEN gewerbesteuerlichen Freibetrag.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Steuer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KST_SATZ = 0.15;       // § 23 Abs. 1 KStG - Satz bis VZ 2027
  var SOLI_SATZ = 0.055;     // SolzG - 5,5 % der Körperschaftsteuer
  var GEWST_MESSZAHL = 0.035;// § 11 Abs. 2 GewStG
  var GEWST_HZ_FREIBETRAG = 200000;   // § 8 Nr. 1 GewStG - Freibetrag
  var MINDESTBEST_SOCKEL = 1000000;   // § 10d Abs. 2 EStG - Sockelbetrag

  /* Körperschaftsteuersatz nach Veranlagungszeitraum. Das "Gesetz für ein
   * steuerliches Investitionssofortprogramm" (2025) senkt den Satz ab VZ 2028
   * stufenweise: 2028 -> 14 %, 2029 -> 13 %, 2030 -> 12 %, 2031 -> 11 %,
   * ab 2032 -> 10 %. Ohne erkennbaren VZ gilt der aktuelle Satz (15 %). */
  function kstSatz(vz) {
    var j = parseInt(vz, 10);
    if (!j || j <= 2027) return 0.15;
    if (j >= 2032) return 0.10;
    return { 2028: 0.14, 2029: 0.13, 2030: 0.12, 2031: 0.11 }[j];
  }
  /* Veranlagungszeitraum aus dem Abschluss: Jahr des Wirtschaftsjahr-Endes. */
  function vzAus(abschluss) {
    var d = (abschluss && (abschluss.gjBis || abschluss.stichtag)) || '';
    return parseInt(String(d).slice(0, 4), 10) || 0;
  }

  function n(v) {
    var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v)
      .replace(/\s/g, '').replace(',', '.'));
    return isNaN(x) ? 0 : x;
  }
  function cent(v) { return Math.round(n(v) * 100) / 100; }

  /* Verlustabzug nach § 10d Abs. 2 EStG mit Mindestbesteuerung: bis zum
   * Sockelbetrag (1 Mio EUR) voll, darüber nur 60 % des übersteigenden
   * Betrags. Liefert den abziehbaren Betrag und den verbleibenden Vortrag. */
  function verlustabzug(einkommen, vortrag) {
    einkommen = cent(einkommen); vortrag = cent(n(vortrag));
    if (einkommen <= 0 || vortrag <= 0) return { abzug: 0, rest: vortrag };
    var grenze = einkommen <= MINDESTBEST_SOCKEL ? einkommen
      : cent(MINDESTBEST_SOCKEL + (einkommen - MINDESTBEST_SOCKEL) * 0.6);
    var abzug = cent(Math.min(vortrag, grenze));
    return { abzug: abzug, rest: cent(vortrag - abzug) };
  }

  /* berechnet die Steuern.
   * abschluss: Abschluss-Objekt mit .steuer-Block und (für JA) GuV-Werten.
   * guvErgebnis: Ergebnis von Berechnung.rechneGuv (optional, sonst 0).      */
  function berechne(abschluss, guvErgebnis) {
    var st = (abschluss && abschluss.steuer) || {};
    var guv = guvErgebnis || { werte: {}, jahresergebnis: 0 };
    var hinweise = [];

    // Ergebnis vor Ertragsteuern = Jahresergebnis + verbuchte Steuern vom Einkommen
    var steuernVomEinkommen = n(guv.werte['gkv.14']) + n(guv.werte['ukv.13']) + n(guv.werte['kst.7']);
    var vorSteuern = cent(n(guv.jahresergebnis) + steuernVomEinkommen);

    var hebesatz = n(st.hebesatz) || 400;
    var divid = n(st.beteiligungsertraege);
    var veraeuss = n(st.veraeusserungsgewinne);
    var nichtAbzb = n(st.nichtAbziehbareAufwendungen);
    var vga = n(st.vga);
    var verlustvortrag = n(st.verlustvortrag);
    var zinsen = n(st.zinsaufwand);
    var mietBew = n(st.mietenBeweglich);
    var mietUnbew = n(st.mietenUnbeweglich);
    var lizenzen = n(st.lizenzen);

    /* ---- Körperschaftsteuer ---- */
    var kstSchritte = [];
    var zvE = vorSteuern;
    kstSchritte.push({ text: 'Ergebnis vor Ertragsteuern (Handelsbilanz)', betrag: vorSteuern });

    if (nichtAbzb > 0) {
      zvE = cent(zvE + nichtAbzb);
      kstSchritte.push({ text: '+ nicht abziehbare Betriebsausgaben', betrag: nichtAbzb });
    }
    if (vga > 0) {
      zvE = cent(zvE + vga);
      kstSchritte.push({ text: '+ verdeckte Gewinnausschüttung (§ 8 Abs. 3 KStG)', betrag: vga });
    }
    // § 8b KStG - Dividenden. Abs. 7: Anteile im Handelsbestand einer
    // Trading-/Finanzunternehmens-GmbH sind von der Freistellung ausgenommen.
    if (divid > 0) {
      if (st.finanzunternehmen) {
        kstSchritte.push({ text: 'Dividenden voll steuerpflichtig (Anteile im ' +
          'Handelsbestand, § 8b Abs. 7 KStG)', betrag: 0 });
      } else if (st.beteiligungUnter10) {
        kstSchritte.push({ text: 'Dividenden voll steuerpflichtig (Streubesitz < 10 %, ' +
          '§ 8b Abs. 4 KStG)', betrag: 0 });
      } else {
        var divFrei = cent(divid * 0.95);
        zvE = cent(zvE - divFrei);
        kstSchritte.push({ text: '- 95 % der Beteiligungserträge steuerfrei ' +
          '(§ 8b Abs. 1/5 KStG)', betrag: -divFrei });
      }
    }
    // § 8b Abs. 2/3 KStG - Veräußerungsgewinne (keine Streubesitzgrenze;
    // Abs. 7: Ausnahme fuer Anteile im Handelsbestand)
    if (veraeuss > 0) {
      if (st.finanzunternehmen) {
        kstSchritte.push({ text: 'Veräußerungsgewinne voll steuerpflichtig (Anteile ' +
          'im Handelsbestand, § 8b Abs. 7 KStG)', betrag: 0 });
      } else {
        var verFrei = cent(veraeuss * 0.95);
        zvE = cent(zvE - verFrei);
        kstSchritte.push({ text: '- 95 % der Veräußerungsgewinne steuerfrei ' +
          '(§ 8b Abs. 2/3 KStG)', betrag: -verFrei });
      }
    }
    if (zvE < 0) zvE = 0;
    // Verlustvortrag § 10d EStG (i. V. m. § 8 Abs. 1 KStG)
    var vvKst = verlustabzug(zvE, verlustvortrag);
    if (vvKst.abzug > 0) {
      zvE = cent(zvE - vvKst.abzug);
      kstSchritte.push({ text: '- Verlustvortrag (§ 10d EStG)', betrag: -vvKst.abzug });
    }
    var vz = vzAus(abschluss);
    var satz = kstSatz(vz);
    var kst = cent(zvE * satz);
    var soli = cent(kst * SOLI_SATZ);
    kstSchritte.push({ text: '= zu versteuerndes Einkommen', betrag: zvE, summe: true });
    kstSchritte.push({ text: 'Körperschaftsteuer ' + Math.round(satz * 100) + ' %' +
      (vz && vz >= 2028 ? ' (VZ ' + vz + ')' : ''), betrag: kst });
    kstSchritte.push({ text: 'Solidaritätszuschlag 5,5 %', betrag: soli });

    /* ---- Gewerbesteuer ---- */
    var gewSchritte = [];
    var gewerbeertrag = vorSteuern;
    gewSchritte.push({ text: 'Gewinn aus Gewerbebetrieb', betrag: vorSteuern });
    if (nichtAbzb > 0) {
      gewerbeertrag = cent(gewerbeertrag + nichtAbzb);
      gewSchritte.push({ text: '+ nicht abziehbare Betriebsausgaben', betrag: nichtAbzb });
    }
    if (vga > 0) {
      gewerbeertrag = cent(gewerbeertrag + vga);
      gewSchritte.push({ text: '+ verdeckte Gewinnausschüttung', betrag: vga });
    }
    // § 8b wirkt auch gewerbesteuerlich (entfaellt bei § 8b Abs. 7)
    if (divid > 0 && !st.beteiligungUnter10 && !st.finanzunternehmen) {
      var divFreiG = cent(divid * 0.95);
      gewerbeertrag = cent(gewerbeertrag - divFreiG);
      gewSchritte.push({ text: '- 95 % Beteiligungserträge (§ 8b KStG)', betrag: -divFreiG });
      // Streubesitz < 15 %: Hinzurechnung nach § 8 Nr. 5 GewStG
      if (st.beteiligungUnter15) {
        gewerbeertrag = cent(gewerbeertrag + divFreiG);
        gewSchritte.push({ text: '+ Hinzurechnung Streubesitzdividende ' +
          '(< 15 %, § 8 Nr. 5 GewStG)', betrag: divFreiG });
      }
    }
    if (veraeuss > 0 && !st.finanzunternehmen) {
      var verFreiG = cent(veraeuss * 0.95);
      gewerbeertrag = cent(gewerbeertrag - verFreiG);
      gewSchritte.push({ text: '- 95 % Veräußerungsgewinne (§ 8b KStG)', betrag: -verFreiG });
    }
    // § 8 Nr. 1 GewStG - Hinzurechnung von Finanzierungsanteilen: 25 % der
    // Summe aus Zinsen (100 %), Mieten bewegl. WG (20 %), Mieten unbewegl. WG
    // (50 %) und Lizenzen (25 %), soweit sie den Freibetrag 200.000 EUR
    // übersteigt.
    var hzBasis = cent(zinsen + mietBew * 0.20 + mietUnbew * 0.50 + lizenzen * 0.25);
    var hzUeber = Math.max(0, cent(hzBasis - GEWST_HZ_FREIBETRAG));
    var hinzurechnung = cent(hzUeber * 0.25);
    if (hinzurechnung > 0) {
      gewerbeertrag = cent(gewerbeertrag + hinzurechnung);
      gewSchritte.push({ text: '+ Hinzurechnungen (§ 8 Nr. 1 GewStG, 25 % über ' +
        'Freibetrag 200.000 EUR)', betrag: hinzurechnung });
    }
    // § 9 Nr. 1 GewStG - Grundstücks-Kürzung
    if (st.erweiterteKuerzung && n(st.immobilienertrag) > 0) {
      var kuerz = cent(Math.min(n(st.immobilienertrag), Math.max(gewerbeertrag, 0)));
      gewerbeertrag = cent(gewerbeertrag - kuerz);
      gewSchritte.push({ text: '- erweiterte Kürzung Grundbesitz ' +
        '(§ 9 Nr. 1 Satz 2 GewStG)', betrag: -kuerz });
    } else if (n(st.einfacheKuerzungGrundbesitzwert) > 0) {
      var kuerzE = cent(n(st.einfacheKuerzungGrundbesitzwert) * 0.0011);
      gewerbeertrag = cent(gewerbeertrag - kuerzE);
      gewSchritte.push({ text: '- einfache Kürzung 0,11 % des Grundsteuerwerts ' +
        '(§ 9 Nr. 1 Satz 1 GewStG)', betrag: -kuerzE });
    }
    if (gewerbeertrag < 0) gewerbeertrag = 0;
    // Gewerbeverlust § 10a GewStG (Mindestbesteuerung wie § 10d EStG)
    var vvGew = verlustabzug(gewerbeertrag, verlustvortrag);
    if (vvGew.abzug > 0) {
      gewerbeertrag = cent(gewerbeertrag - vvGew.abzug);
      gewSchritte.push({ text: '- Gewerbeverlust (§ 10a GewStG)', betrag: -vvGew.abzug });
    }
    // auf volle 100 EUR abrunden (§ 11 Abs. 1 GewStG); kein Freibetrag für KapG
    var gewerbeertragGerundet = Math.floor(gewerbeertrag / 100) * 100;
    var messbetrag = cent(gewerbeertragGerundet * GEWST_MESSZAHL);
    var gewst = cent(messbetrag * hebesatz / 100);
    gewSchritte.push({ text: '= Gewerbeertrag (abgerundet)', betrag: gewerbeertragGerundet, summe: true });
    gewSchritte.push({ text: 'Steuermessbetrag 3,5 %', betrag: messbetrag });
    gewSchritte.push({ text: 'Gewerbesteuer (Hebesatz ' + hebesatz + ' %)', betrag: gewst });

    /* ---- Hinweise zu den Sonderfällen ---- */
    if (vga > 0) {
      hinweise.push('Verdeckte Gewinnausschüttung: außerbilanziell dem Einkommen ' +
        'hinzugerechnet. Sie löst beim Gesellschafter zusätzlich Kapitalertragsteuer ' +
        'aus (siehe Kapitalertragsteuer-Assistent) - im Zweifel steuerlich prüfen lassen.');
    }
    if (verlustvortrag > 0) {
      hinweise.push('Verlustvortrag: körperschaftsteuerlicher (§ 10d EStG) und ' +
        'gewerbesteuerlicher Fehlbetrag (§ 10a GewStG) sind rechtlich getrennte ' +
        'Töpfe; hier wird derselbe Wert für beide angesetzt. Weichen sie ab, die ' +
        'Werte getrennt prüfen.');
    }
    if (st.anteilseignerwechsel) {
      hinweise.push('§ 8c KStG: Bei einem Anteilseignerwechsel von mehr als 50 % ' +
        'geht ein nicht genutzter Verlustvortrag grundsätzlich unter. Ein Antrag ' +
        'nach § 8d KStG (fortführungsgebundener Verlustvortrag) kann das verhindern - ' +
        'steuerlich prüfen lassen.');
    }

    var gesamt = cent(kst + soli + gewst);
    return {
      ergebnisVorSteuern: vorSteuern,
      kst: { zvE: zvE, betrag: kst, soli: soli, satz: satz, schritte: kstSchritte },
      gewst: { gewerbeertrag: gewerbeertragGerundet, messbetrag: messbetrag,
               betrag: gewst, hebesatz: hebesatz, schritte: gewSchritte },
      hinzurechnungGewSt: hinzurechnung,
      verlustvortrag: { eingesetztKst: vvKst.abzug, eingesetztGewSt: vvGew.abzug,
                        restKst: vvKst.rest, restGewSt: vvGew.rest },
      hinweise: hinweise,
      gesamtsteuer: gesamt,
      ergebnisNachSteuern: cent(vorSteuern - gesamt),
      durchschnittsbelastung: vorSteuern > 0 ? cent(gesamt / vorSteuern * 100) : 0
    };
  }

  return { berechne: berechne, kstSatz: kstSatz, verlustabzug: verlustabzug,
           KST_SATZ: KST_SATZ, SOLI_SATZ: SOLI_SATZ, GEWST_MESSZAHL: GEWST_MESSZAHL,
           GEWST_HZ_FREIBETRAG: GEWST_HZ_FREIBETRAG, cent: cent };
});
