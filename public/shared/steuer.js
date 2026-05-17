/* ===========================================================================
 * steuer.js  -  Überschlägige Steuerberechnung (KSt, Soli, GewSt)
 * ---------------------------------------------------------------------------
 * Berechnet aus dem handelsrechtlichen Jahresergebnis überschlägig die
 * Ertragsteuern einer GmbH - mit den Besonderheiten der VERMOEGENS-
 * VERWALTENDEN GmbH:
 *   - § 8b KStG     Beteiligungserträge/Veräußerungsgewinne 95 % steuerfrei
 *   - § 8b Abs. 4   Streubesitz < 10 % -> Dividende voll körperschaftsteuerpfl.
 *   - § 8 Nr. 5 /   Streubesitz < 15 % -> Dividende gewerbesteuerpflichtig
 *     § 9 Nr. 2a GewStG
 *   - § 9 Nr. 1 GewStG  einfache und erweiterte Grundstücks-Kürzung
 *
 * WICHTIG: Dies ist eine überschlägige Orientierungsrechnung, KEINE
 * verbindliche Steuerberechnung. Hinzurechnungen/Kürzungen nach §§ 8/9 GewStG
 * sind nur teilweise abgebildet. Im Zweifel Steuerberater hinzuziehen.
 *
 * Sätze (Stand 2026): KSt 15 % (§ 23 KStG), Soli 5,5 % auf die KSt,
 * GewSt-Steuermesszahl 3,5 % (§ 11 GewStG). Kapitalgesellschaften haben
 * KEINEN gewerbesteuerlichen Freibetrag.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Steuer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KST_SATZ = 0.15;       // § 23 Abs. 1 KStG
  var SOLI_SATZ = 0.055;     // SolzG - 5,5 % der Körperschaftsteuer
  var GEWST_MESSZAHL = 0.035;// § 11 Abs. 2 GewStG

  function n(v) {
    var x = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v)
      .replace(/\s/g, '').replace(',', '.'));
    return isNaN(x) ? 0 : x;
  }
  function cent(v) { return Math.round(n(v) * 100) / 100; }

  /* berechnet die Steuern.
   * abschluss: Abschluss-Objekt mit .steuer-Block und (für JA) GuV-Werten.
   * guvErgebnis: Ergebnis von Berechnung.rechneGuv (optional, sonst 0).      */
  function berechne(abschluss, guvErgebnis) {
    var st = (abschluss && abschluss.steuer) || {};
    var guv = guvErgebnis || { werte: {}, jahresergebnis: 0 };

    // Ergebnis vor Ertragsteuern = Jahresergebnis + verbuchte Steuern vom Einkommen
    var steuernVomEinkommen = n(guv.werte['gkv.14']) + n(guv.werte['ukv.13']) + n(guv.werte['kst.7']);
    var vorSteuern = cent(n(guv.jahresergebnis) + steuernVomEinkommen);

    var hebesatz = n(st.hebesatz) || 400;
    var divid = n(st.beteiligungsertraege);
    var veraeuss = n(st.veraeusserungsgewinne);
    var nichtAbzb = n(st.nichtAbziehbareAufwendungen);

    /* ---- Körperschaftsteuer ---- */
    var kstSchritte = [];
    var zvE = vorSteuern;
    kstSchritte.push({ text: 'Ergebnis vor Ertragsteuern (Handelsbilanz)', betrag: vorSteuern });

    if (nichtAbzb > 0) {
      zvE = cent(zvE + nichtAbzb);
      kstSchritte.push({ text: '+ nicht abziehbare Betriebsausgaben', betrag: nichtAbzb });
    }
    // § 8b Abs. 1/4/5 KStG - Dividenden
    if (divid > 0) {
      if (st.beteiligungUnter10) {
        kstSchritte.push({ text: 'Dividenden voll steuerpflichtig (Streubesitz < 10 %, ' +
          '§ 8b Abs. 4 KStG)', betrag: 0 });
      } else {
        var divFrei = cent(divid * 0.95);
        zvE = cent(zvE - divFrei);
        kstSchritte.push({ text: '- 95 % der Beteiligungserträge steuerfrei ' +
          '(§ 8b Abs. 1/5 KStG)', betrag: -divFrei });
      }
    }
    // § 8b Abs. 2/3 KStG - Veräußerungsgewinne (keine Streubesitzgrenze)
    if (veraeuss > 0) {
      var verFrei = cent(veraeuss * 0.95);
      zvE = cent(zvE - verFrei);
      kstSchritte.push({ text: '- 95 % der Veräußerungsgewinne steuerfrei ' +
        '(§ 8b Abs. 2/3 KStG)', betrag: -verFrei });
    }
    if (zvE < 0) zvE = 0;
    var kst = cent(zvE * KST_SATZ);
    var soli = cent(kst * SOLI_SATZ);
    kstSchritte.push({ text: '= zu versteuerndes Einkommen', betrag: zvE, summe: true });
    kstSchritte.push({ text: 'Körperschaftsteuer 15 %', betrag: kst });
    kstSchritte.push({ text: 'Solidaritätszuschlag 5,5 %', betrag: soli });

    /* ---- Gewerbesteuer ---- */
    var gewSchritte = [];
    var gewerbeertrag = vorSteuern;
    gewSchritte.push({ text: 'Gewinn aus Gewerbebetrieb', betrag: vorSteuern });
    if (nichtAbzb > 0) {
      gewerbeertrag = cent(gewerbeertrag + nichtAbzb);
      gewSchritte.push({ text: '+ nicht abziehbare Betriebsausgaben', betrag: nichtAbzb });
    }
    // § 8b wirkt auch gewerbesteuerlich
    if (divid > 0 && !st.beteiligungUnter10) {
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
    if (veraeuss > 0) {
      var verFreiG = cent(veraeuss * 0.95);
      gewerbeertrag = cent(gewerbeertrag - verFreiG);
      gewSchritte.push({ text: '- 95 % Veräußerungsgewinne (§ 8b KStG)', betrag: -verFreiG });
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
    // auf volle 100 EUR abrunden (§ 11 Abs. 1 GewStG); kein Freibetrag für KapG
    var gewerbeertragGerundet = Math.floor(gewerbeertrag / 100) * 100;
    var messbetrag = cent(gewerbeertragGerundet * GEWST_MESSZAHL);
    var gewst = cent(messbetrag * hebesatz / 100);
    gewSchritte.push({ text: '= Gewerbeertrag (abgerundet)', betrag: gewerbeertragGerundet, summe: true });
    gewSchritte.push({ text: 'Steuermessbetrag 3,5 %', betrag: messbetrag });
    gewSchritte.push({ text: 'Gewerbesteuer (Hebesatz ' + hebesatz + ' %)', betrag: gewst });

    var gesamt = cent(kst + soli + gewst);
    return {
      ergebnisVorSteuern: vorSteuern,
      kst: { zvE: zvE, betrag: kst, soli: soli, schritte: kstSchritte },
      gewst: { gewerbeertrag: gewerbeertragGerundet, messbetrag: messbetrag,
               betrag: gewst, hebesatz: hebesatz, schritte: gewSchritte },
      gesamtsteuer: gesamt,
      ergebnisNachSteuern: cent(vorSteuern - gesamt),
      durchschnittsbelastung: vorSteuern > 0 ? cent(gesamt / vorSteuern * 100) : 0
    };
  }

  return { berechne: berechne, KST_SATZ: KST_SATZ, SOLI_SATZ: SOLI_SATZ,
           GEWST_MESSZAHL: GEWST_MESSZAHL, cent: cent };
});
