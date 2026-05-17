/* ===========================================================================
 * positionen.js  -  HGB-Gliederung für Bilanz und GuV
 * ---------------------------------------------------------------------------
 * Bildet die gesetzlich vorgeschriebene Gliederung ab:
 *   - Bilanz:  § 266 HGB  (Aktiva Abs. 2, Passiva Abs. 3)
 *   - GuV:     § 275 HGB  (Abs. 2 Gesamtkostenverfahren, Abs. 3 Umsatzkosten-
 *              verfahren, Abs. 5 verkürzte GuV für Kleinstkapitalgesellschaften)
 *   - Größenklassen: § 267 / § 267a HGB
 *
 * Diese Datei läuft sowohl in Node (require) als auch im Browser (<script>).
 *
 * Knoten-Typen ("typ"):
 *   'B' = mit Buchstaben bezeichneter Posten (A, B, C ...)   -> immer auszuweisen
 *   'R' = mit römischer Zahl bezeichneter Posten (I, II ...)
 *   'N' = mit arabischer Zahl bezeichneter Unterposten (1, 2 ...)
 *
 * Die Verkürzungsstufen (§ 266 Abs. 1 HGB):
 *   - Kleinstkapitalgesellschaft (§ 267a): nur 'B'-Posten
 *   - kleine Kapitalgesellschaft (§ 267 Abs. 1): 'B'- und 'R'-Posten
 *   - mittelgross/gross: alle Posten
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Positionen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- Bilanz: AKTIVSEITE  (§ 266 Abs. 2 HGB) --------------------------- */
  var AKTIVA = [
    { id: 'A', nr: 'A.', typ: 'B', label: 'Anlagevermögen', kinder: [
      { id: 'A.I', nr: 'I.', typ: 'R', label: 'Immaterielle Vermögensgegenstände', kinder: [
        { id: 'A.I.1', nr: '1.', typ: 'N', label: 'Selbst geschaffene gewerbliche Schutzrechte und ähnliche Rechte und Werte' },
        { id: 'A.I.2', nr: '2.', typ: 'N', label: 'entgeltlich erworbene Konzessionen, gewerbliche Schutzrechte und ähnliche Rechte und Werte sowie Lizenzen an solchen Rechten und Werten' },
        { id: 'A.I.3', nr: '3.', typ: 'N', label: 'Geschäfts- oder Firmenwert' },
        { id: 'A.I.4', nr: '4.', typ: 'N', label: 'geleistete Anzahlungen' }
      ]},
      { id: 'A.II', nr: 'II.', typ: 'R', label: 'Sachanlagen', kinder: [
        { id: 'A.II.1', nr: '1.', typ: 'N', label: 'Grundstücke, grundstücksgleiche Rechte und Bauten einschließlich der Bauten auf fremden Grundstücken' },
        { id: 'A.II.2', nr: '2.', typ: 'N', label: 'technische Anlagen und Maschinen' },
        { id: 'A.II.3', nr: '3.', typ: 'N', label: 'andere Anlagen, Betriebs- und Geschäftsausstattung' },
        { id: 'A.II.4', nr: '4.', typ: 'N', label: 'geleistete Anzahlungen und Anlagen im Bau' }
      ]},
      { id: 'A.III', nr: 'III.', typ: 'R', label: 'Finanzanlagen', kinder: [
        { id: 'A.III.1', nr: '1.', typ: 'N', label: 'Anteile an verbundenen Unternehmen' },
        { id: 'A.III.2', nr: '2.', typ: 'N', label: 'Ausleihungen an verbundene Unternehmen' },
        { id: 'A.III.3', nr: '3.', typ: 'N', label: 'Beteiligungen' },
        { id: 'A.III.4', nr: '4.', typ: 'N', label: 'Ausleihungen an Unternehmen, mit denen ein Beteiligungsverhältnis besteht' },
        { id: 'A.III.5', nr: '5.', typ: 'N', label: 'Wertpapiere des Anlagevermögens' },
        { id: 'A.III.6', nr: '6.', typ: 'N', label: 'sonstige Ausleihungen' }
      ]}
    ]},
    { id: 'B', nr: 'B.', typ: 'B', label: 'Umlaufvermögen', kinder: [
      { id: 'B.I', nr: 'I.', typ: 'R', label: 'Vorräte', kinder: [
        { id: 'B.I.1', nr: '1.', typ: 'N', label: 'Roh-, Hilfs- und Betriebsstoffe' },
        { id: 'B.I.2', nr: '2.', typ: 'N', label: 'unfertige Erzeugnisse, unfertige Leistungen' },
        { id: 'B.I.3', nr: '3.', typ: 'N', label: 'fertige Erzeugnisse und Waren' },
        { id: 'B.I.4', nr: '4.', typ: 'N', label: 'geleistete Anzahlungen' }
      ]},
      { id: 'B.II', nr: 'II.', typ: 'R', label: 'Forderungen und sonstige Vermögensgegenstände', kinder: [
        { id: 'B.II.1', nr: '1.', typ: 'N', label: 'Forderungen aus Lieferungen und Leistungen' },
        { id: 'B.II.2', nr: '2.', typ: 'N', label: 'Forderungen gegen verbundene Unternehmen' },
        { id: 'B.II.3', nr: '3.', typ: 'N', label: 'Forderungen gegen Unternehmen, mit denen ein Beteiligungsverhältnis besteht' },
        { id: 'B.II.4', nr: '4.', typ: 'N', label: 'sonstige Vermögensgegenstände' }
      ]},
      { id: 'B.III', nr: 'III.', typ: 'R', label: 'Wertpapiere', kinder: [
        { id: 'B.III.1', nr: '1.', typ: 'N', label: 'Anteile an verbundenen Unternehmen' },
        { id: 'B.III.2', nr: '2.', typ: 'N', label: 'sonstige Wertpapiere' }
      ]},
      { id: 'B.IV', nr: 'IV.', typ: 'R', label: 'Kassenbestand, Bundesbankguthaben, Guthaben bei Kreditinstituten und Schecks', leafR: true }
    ]},
    { id: 'C', nr: 'C.', typ: 'B', label: 'Rechnungsabgrenzungsposten' },
    { id: 'D', nr: 'D.', typ: 'B', label: 'Aktive latente Steuern' },
    { id: 'E', nr: 'E.', typ: 'B', label: 'Aktiver Unterschiedsbetrag aus der Vermögensverrechnung' },
    { id: 'F', nr: 'F.', typ: 'B', label: 'Nicht durch Eigenkapital gedeckter Fehlbetrag', auto: true,
      hinweis: 'Ausweis nach § 268 Abs. 3 HGB, wenn das Eigenkapital durch Verluste aufgebraucht ist. Wird automatisch berechnet.' }
  ];

  /* ---- Bilanz: PASSIVSEITE  (§ 266 Abs. 3 HGB) -------------------------- */
  var PASSIVA = [
    { id: 'P.A', nr: 'A.', typ: 'B', label: 'Eigenkapital', kinder: [
      { id: 'P.A.I',   nr: 'I.',   typ: 'R', label: 'Gezeichnetes Kapital',
        hinweis: 'Stammkapital lt. Gesellschaftsvertrag (Nennbetrag), § 272 Abs. 1 HGB. Nicht eingeforderte ausstehende Einlagen werden offen abgesetzt.' },
      { id: 'P.A.II',  nr: 'II.',  typ: 'R', label: 'Kapitalrücklage' },
      { id: 'P.A.III', nr: 'III.', typ: 'R', label: 'Gewinnrücklagen', kinder: [
        { id: 'P.A.III.1', nr: '1.', typ: 'N', label: 'gesetzliche Rücklage' },
        { id: 'P.A.III.2', nr: '2.', typ: 'N', label: 'Rücklage für Anteile an einem herrschenden oder mehrheitlich beteiligten Unternehmen' },
        { id: 'P.A.III.3', nr: '3.', typ: 'N', label: 'satzungsmäßige Rücklagen' },
        { id: 'P.A.III.4', nr: '4.', typ: 'N', label: 'andere Gewinnrücklagen' }
      ]},
      { id: 'P.A.IV', nr: 'IV.', typ: 'R', label: 'Gewinnvortrag/Verlustvortrag' },
      { id: 'P.A.V',  nr: 'V.',  typ: 'R', label: 'Jahresüberschuss/Jahresfehlbetrag', auto: true,
        hinweis: 'Wird beim Jahresabschluss automatisch aus der GuV übernommen.' }
    ]},
    { id: 'P.B', nr: 'B.', typ: 'B', label: 'Rückstellungen', kinder: [
      { id: 'P.B.1', nr: '1.', typ: 'N', label: 'Rückstellungen für Pensionen und ähnliche Verpflichtungen' },
      { id: 'P.B.2', nr: '2.', typ: 'N', label: 'Steuerrückstellungen' },
      { id: 'P.B.3', nr: '3.', typ: 'N', label: 'sonstige Rückstellungen' }
    ]},
    { id: 'P.C', nr: 'C.', typ: 'B', label: 'Verbindlichkeiten', kinder: [
      { id: 'P.C.1', nr: '1.', typ: 'N', label: 'Anleihen' },
      { id: 'P.C.2', nr: '2.', typ: 'N', label: 'Verbindlichkeiten gegenüber Kreditinstituten' },
      { id: 'P.C.3', nr: '3.', typ: 'N', label: 'erhaltene Anzahlungen auf Bestellungen' },
      { id: 'P.C.4', nr: '4.', typ: 'N', label: 'Verbindlichkeiten aus Lieferungen und Leistungen' },
      { id: 'P.C.5', nr: '5.', typ: 'N', label: 'Verbindlichkeiten aus der Annahme gezogener Wechsel und der Ausstellung eigener Wechsel' },
      { id: 'P.C.6', nr: '6.', typ: 'N', label: 'Verbindlichkeiten gegenüber verbundenen Unternehmen' },
      { id: 'P.C.7', nr: '7.', typ: 'N', label: 'Verbindlichkeiten gegenüber Unternehmen, mit denen ein Beteiligungsverhältnis besteht' },
      { id: 'P.C.8', nr: '8.', typ: 'N', label: 'sonstige Verbindlichkeiten' }
    ]},
    { id: 'P.D', nr: 'D.', typ: 'B', label: 'Rechnungsabgrenzungsposten' },
    { id: 'P.E', nr: 'E.', typ: 'B', label: 'Passive latente Steuern' }
  ];

  /* ---- GuV: Gesamtkostenverfahren  (§ 275 Abs. 2 HGB) ------------------- */
  /* art: 'E' Ertrag (+), 'A' Aufwand (-), 'Z' Zwischensumme, 'S' Saldo/Ergebnis
   * sub: arabische Unterposten (Buchstaben a/b) */
  var GUV_GKV = [
    { id: 'gkv.1',  nr: '1.',  art: 'E', label: 'Umsatzerlöse' },
    { id: 'gkv.2',  nr: '2.',  art: 'E', label: 'Erhöhung oder Verminderung des Bestands an fertigen und unfertigen Erzeugnissen', negativErlaubt: true },
    { id: 'gkv.3',  nr: '3.',  art: 'E', label: 'andere aktivierte Eigenleistungen' },
    { id: 'gkv.4',  nr: '4.',  art: 'E', label: 'sonstige betriebliche Erträge' },
    { id: 'gkv.5',  nr: '5.',  art: 'A', label: 'Materialaufwand', kinder: [
      { id: 'gkv.5a', nr: 'a)', art: 'A', label: 'Aufwendungen für Roh-, Hilfs- und Betriebsstoffe und für bezogene Waren' },
      { id: 'gkv.5b', nr: 'b)', art: 'A', label: 'Aufwendungen für bezogene Leistungen' }
    ]},
    { id: 'gkv.6',  nr: '6.',  art: 'A', label: 'Personalaufwand', kinder: [
      { id: 'gkv.6a', nr: 'a)', art: 'A', label: 'Löhne und Gehälter' },
      { id: 'gkv.6b', nr: 'b)', art: 'A', label: 'soziale Abgaben und Aufwendungen für Altersversorgung und für Unterstützung' }
    ]},
    { id: 'gkv.7',  nr: '7.',  art: 'A', label: 'Abschreibungen', kinder: [
      { id: 'gkv.7a', nr: 'a)', art: 'A', label: 'auf immaterielle Vermögensgegenstände des Anlagevermögens und Sachanlagen' },
      { id: 'gkv.7b', nr: 'b)', art: 'A', label: 'auf Vermögensgegenstände des Umlaufvermögens, soweit diese die in der Kapitalgesellschaft üblichen Abschreibungen überschreiten' }
    ]},
    { id: 'gkv.8',  nr: '8.',  art: 'A', label: 'sonstige betriebliche Aufwendungen' },
    { id: 'gkv.9',  nr: '9.',  art: 'E', label: 'Erträge aus Beteiligungen' },
    { id: 'gkv.10', nr: '10.', art: 'E', label: 'Erträge aus anderen Wertpapieren und Ausleihungen des Finanzanlagevermögens' },
    { id: 'gkv.11', nr: '11.', art: 'E', label: 'sonstige Zinsen und ähnliche Erträge' },
    { id: 'gkv.12', nr: '12.', art: 'A', label: 'Abschreibungen auf Finanzanlagen und auf Wertpapiere des Umlaufvermögens' },
    { id: 'gkv.13', nr: '13.', art: 'A', label: 'Zinsen und ähnliche Aufwendungen' },
    { id: 'gkv.14', nr: '14.', art: 'A', label: 'Steuern vom Einkommen und vom Ertrag' },
    { id: 'gkv.15', nr: '15.', art: 'Z', label: 'Ergebnis nach Steuern', formel: ['gkv.1','gkv.2','gkv.3','gkv.4','-gkv.5','-gkv.6','-gkv.7','-gkv.8','gkv.9','gkv.10','gkv.11','-gkv.12','-gkv.13','-gkv.14'] },
    { id: 'gkv.16', nr: '16.', art: 'A', label: 'sonstige Steuern' },
    { id: 'gkv.17', nr: '17.', art: 'S', label: 'Jahresüberschuss/Jahresfehlbetrag', formel: ['gkv.15','-gkv.16'] }
  ];

  /* ---- GuV: Umsatzkostenverfahren  (§ 275 Abs. 3 HGB) ------------------- */
  var GUV_UKV = [
    { id: 'ukv.1',  nr: '1.',  art: 'E', label: 'Umsatzerlöse' },
    { id: 'ukv.2',  nr: '2.',  art: 'A', label: 'Herstellungskosten der zur Erzielung der Umsatzerlöse erbrachten Leistungen' },
    { id: 'ukv.3',  nr: '3.',  art: 'Z', label: 'Bruttoergebnis vom Umsatz', formel: ['ukv.1','-ukv.2'] },
    { id: 'ukv.4',  nr: '4.',  art: 'A', label: 'Vertriebskosten' },
    { id: 'ukv.5',  nr: '5.',  art: 'A', label: 'allgemeine Verwaltungskosten' },
    { id: 'ukv.6',  nr: '6.',  art: 'E', label: 'sonstige betriebliche Erträge' },
    { id: 'ukv.7',  nr: '7.',  art: 'A', label: 'sonstige betriebliche Aufwendungen' },
    { id: 'ukv.8',  nr: '8.',  art: 'E', label: 'Erträge aus Beteiligungen' },
    { id: 'ukv.9',  nr: '9.',  art: 'E', label: 'Erträge aus anderen Wertpapieren und Ausleihungen des Finanzanlagevermögens' },
    { id: 'ukv.10', nr: '10.', art: 'E', label: 'sonstige Zinsen und ähnliche Erträge' },
    { id: 'ukv.11', nr: '11.', art: 'A', label: 'Abschreibungen auf Finanzanlagen und auf Wertpapiere des Umlaufvermögens' },
    { id: 'ukv.12', nr: '12.', art: 'A', label: 'Zinsen und ähnliche Aufwendungen' },
    { id: 'ukv.13', nr: '13.', art: 'A', label: 'Steuern vom Einkommen und vom Ertrag' },
    { id: 'ukv.14', nr: '14.', art: 'Z', label: 'Ergebnis nach Steuern', formel: ['ukv.3','-ukv.4','-ukv.5','ukv.6','-ukv.7','ukv.8','ukv.9','ukv.10','-ukv.11','-ukv.12','-ukv.13'] },
    { id: 'ukv.15', nr: '15.', art: 'A', label: 'sonstige Steuern' },
    { id: 'ukv.16', nr: '16.', art: 'S', label: 'Jahresüberschuss/Jahresfehlbetrag', formel: ['ukv.14','-ukv.15'] }
  ];

  /* ---- GuV: verkürzt für Kleinstkapitalgesellschaften (§ 275 Abs. 5) -- */
  var GUV_KLEINST = [
    { id: 'kst.1', nr: '1.', art: 'E', label: 'Umsatzerlöse' },
    { id: 'kst.2', nr: '2.', art: 'E', label: 'sonstige Erträge' },
    { id: 'kst.3', nr: '3.', art: 'A', label: 'Materialaufwand' },
    { id: 'kst.4', nr: '4.', art: 'A', label: 'Personalaufwand' },
    { id: 'kst.5', nr: '5.', art: 'A', label: 'Abschreibungen' },
    { id: 'kst.6', nr: '6.', art: 'A', label: 'sonstige Aufwendungen' },
    { id: 'kst.7', nr: '7.', art: 'A', label: 'Steuern' },
    { id: 'kst.8', nr: '8.', art: 'S', label: 'Jahresüberschuss/Jahresfehlbetrag',
      formel: ['kst.1','kst.2','-kst.3','-kst.4','-kst.5','-kst.6','-kst.7'] }
  ];

  /* ---- Größenklassen  (§ 267, § 267a HGB) ----------------------------- */
  /* Schwellenwerte: ein Unternehmen gehört zu einer Klasse, wenn es an zwei
   * aufeinanderfolgenden Abschlussstichtagen mind. 2 von 3 Merkmalen NICHT
   * überschreitet. Bei Neugründung gilt bereits der erste Stichtag
   * (§ 267 Abs. 4 Satz 2 HGB).
   * "neu" = seit Gesetz vom 16.04.2024, Pflicht ab Geschäftsjahr 2024,
   *         Wahlrecht ab Geschäftsjahr 2023.
   * "alt" = davor. */
  var GROESSENKLASSEN = {
    schwellen: {
      neu: {
        gueltigAbGjBeginn: '2024-01-01',
        wahlrechtAbGjBeginn: '2023-01-01',
        kleinst: { bilanzsumme: 450000,    umsatz: 900000,    arbeitnehmer: 10 },
        klein:   { bilanzsumme: 7500000,   umsatz: 15000000,  arbeitnehmer: 50 },
        mittel:  { bilanzsumme: 25000000,  umsatz: 50000000,  arbeitnehmer: 250 }
      },
      alt: {
        kleinst: { bilanzsumme: 350000,    umsatz: 700000,    arbeitnehmer: 10 },
        klein:   { bilanzsumme: 6000000,   umsatz: 12000000,  arbeitnehmer: 50 },
        mittel:  { bilanzsumme: 20000000,  umsatz: 40000000,  arbeitnehmer: 250 }
      }
    },
    klassen: {
      KLEINST: { name: 'Kleinstkapitalgesellschaft', kurz: 'Kleinst', paragraf: '§ 267a HGB' },
      KLEIN:   { name: 'kleine Kapitalgesellschaft', kurz: 'klein',   paragraf: '§ 267 Abs. 1 HGB' },
      MITTEL:  { name: 'mittelgroße Kapitalgesellschaft', kurz: 'mittelgross', paragraf: '§ 267 Abs. 2 HGB' },
      GROSS:   { name: 'große Kapitalgesellschaft', kurz: 'gross', paragraf: '§ 267 Abs. 3 HGB' }
    }
  };

  /* ---- Hilfsfunktionen -------------------------------------------------- */

  // Baum rekursiv in flache Liste mit Tiefenangabe wandeln
  function flach(baum, ebene, out) {
    ebene = ebene || 0; out = out || [];
    for (var i = 0; i < baum.length; i++) {
      var k = baum[i];
      out.push({ id: k.id, nr: k.nr, typ: k.typ, label: k.label, ebene: ebene,
                 hinweis: k.hinweis, auto: !!k.auto, leafR: !!k.leafR,
                 hatKinder: !!(k.kinder && k.kinder.length) });
      if (k.kinder && k.kinder.length) flach(k.kinder, ebene + 1, out);
    }
    return out;
  }

  // Liefert alle Blattknoten (Eingabepositionen) eines Baums
  function blaetter(baum, out) {
    out = out || [];
    for (var i = 0; i < baum.length; i++) {
      var k = baum[i];
      if (k.kinder && k.kinder.length) blaetter(k.kinder, out);
      else out.push(k);
    }
    return out;
  }

  // Knoten per id finden
  function finde(baum, id) {
    for (var i = 0; i < baum.length; i++) {
      if (baum[i].id === id) return baum[i];
      if (baum[i].kinder) { var t = finde(baum[i].kinder, id); if (t) return t; }
    }
    return null;
  }

  // GuV-Schema zur Verfahrensbezeichnung
  function guvSchema(verfahren) {
    if (verfahren === 'UKV') return GUV_UKV;
    if (verfahren === 'KLEINST') return GUV_KLEINST;
    return GUV_GKV;
  }

  return {
    AKTIVA: AKTIVA,
    PASSIVA: PASSIVA,
    GUV_GKV: GUV_GKV,
    GUV_UKV: GUV_UKV,
    GUV_KLEINST: GUV_KLEINST,
    GROESSENKLASSEN: GROESSENKLASSEN,
    flach: flach,
    blaetter: blaetter,
    finde: finde,
    guvSchema: guvSchema
  };
});
