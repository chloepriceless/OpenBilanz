/* ===========================================================================
 * skr04.js  -  Standardkontenrahmen SKR04 (praxisorientierte Auswahl)
 * ---------------------------------------------------------------------------
 * Kontenrahmen für den Buchhaltungs-Modus. Jedes Konto ist einer HGB-
 * Bilanzposition (§ 266) bzw. einer GuV-Kategorie (§ 275) zugeordnet, sodass
 * aus Buchungssätzen automatisch Bilanz und GuV entstehen.
 *
 * Die Kontonummern folgen dem amtlichen DATEV-SKR04. Diese Auswahl deckt die
 * gebräuchlichen Konten einer kleinen und einer VERMOEGENSVERWALTENDEN GmbH
 * ab (Immobilien, Beteiligungen, Wertpapiere). Der vollständige SKR04 hat
 * ~1500 Konten; die Liste ist im Tool frei erweiterbar.
 *
 * Felder:
 *   nr     vierstellige SKR04-Kontonummer
 *   name   Kontobezeichnung
 *   seite  'AKTIV' | 'PASSIV' | 'ERTRAG' | 'AUFWAND'
 *   pos    HGB-Bilanzpositions-ID (bei AKTIV/PASSIV) - Eingabe-Ebene des Editors
 *   kat    GuV-Kategorie (bei ERTRAG/AUFWAND)
 *   vv     true  = für eine vermögensverwaltende GmbH besonders relevant
 *   eb     true  = typischerweise in der Eröffnungsbilanz bebucht
 *
 * Quellen: amtlicher DATEV-SKR04; vermögensverwaltende Konten zusätzlich
 * abgeglichen mit laroche/trading-gmbh (CC0). Das HGB-Mapping ist eigenständig
 * erstellt und gegen alyf-de/SKR04 plausibilisiert.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SKR04 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KONTEN = [
    /* ===== Klasse 0: Anlagevermögen ================================== */
    /* Immaterielle Vermögensgegenstände -> A.I */
    { nr: '0100', name: 'Konzessionen, gewerbliche Schutzrechte und Lizenzen', seite: 'AKTIV', pos: 'A.I' },
    { nr: '0135', name: 'EDV-Software', seite: 'AKTIV', pos: 'A.I' },
    { nr: '0143', name: 'Selbst geschaffene immaterielle Vermögensgegenstände', seite: 'AKTIV', pos: 'A.I' },
    { nr: '0150', name: 'Geschäfts- oder Firmenwert', seite: 'AKTIV', pos: 'A.I' },
    { nr: '0170', name: 'Geleistete Anzahlungen auf immaterielle Vermögensgegenstände', seite: 'AKTIV', pos: 'A.I' },
    /* Sachanlagen -> A.II */
    { nr: '0200', name: 'Grundstücke, grundstücksgleiche Rechte und Bauten', seite: 'AKTIV', pos: 'A.II', vv: true },
    { nr: '0215', name: 'Unbebaute Grundstücke', seite: 'AKTIV', pos: 'A.II', vv: true },
    { nr: '0220', name: 'Grundstücksgleiche Rechte', seite: 'AKTIV', pos: 'A.II', vv: true },
    { nr: '0235', name: 'Grundstückswerte eigener bebauter Grundstücke', seite: 'AKTIV', pos: 'A.II', vv: true },
    { nr: '0240', name: 'Geschäftsbauten', seite: 'AKTIV', pos: 'A.II', vv: true },
    { nr: '0260', name: 'Andere Bauten', seite: 'AKTIV', pos: 'A.II', vv: true },
    { nr: '0400', name: 'Technische Anlagen und Maschinen', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0440', name: 'Maschinen', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0500', name: 'Andere Anlagen, Betriebs- und Geschäftsausstattung', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0520', name: 'Pkw', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0540', name: 'Lkw', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0650', name: 'Büroeinrichtung', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0670', name: 'Geringwertige Wirtschaftsgüter (GWG)', seite: 'AKTIV', pos: 'A.II' },
    { nr: '0700', name: 'Geleistete Anzahlungen und Anlagen im Bau', seite: 'AKTIV', pos: 'A.II' },
    /* Finanzanlagen -> A.III  (Kern der vermögensverwaltenden GmbH) */
    { nr: '0800', name: 'Anteile an verbundenen Unternehmen', seite: 'AKTIV', pos: 'A.III', vv: true },
    { nr: '0810', name: 'Ausleihungen an verbundene Unternehmen', seite: 'AKTIV', pos: 'A.III', vv: true },
    { nr: '0820', name: 'Beteiligungen', seite: 'AKTIV', pos: 'A.III', vv: true },
    { nr: '0850', name: 'Andere Beteiligungen an Kapitalgesellschaften', seite: 'AKTIV', pos: 'A.III', vv: true },
    { nr: '0880', name: 'Ausleihungen an Unternehmen mit Beteiligungsverhältnis', seite: 'AKTIV', pos: 'A.III', vv: true },
    { nr: '0900', name: 'Wertpapiere des Anlagevermögens', seite: 'AKTIV', pos: 'A.III', vv: true },
    { nr: '0920', name: 'Festverzinsliche Wertpapiere des Anlagevermögens', seite: 'AKTIV', pos: 'A.III', vv: true },

    /* ===== Klasse 1: Umlaufvermögen ================================== */
    /* Vorräte -> B.I */
    { nr: '1000', name: 'Roh-, Hilfs- und Betriebsstoffe', seite: 'AKTIV', pos: 'B.I' },
    { nr: '1100', name: 'Unfertige Erzeugnisse', seite: 'AKTIV', pos: 'B.I' },
    { nr: '1110', name: 'Unfertige Leistungen', seite: 'AKTIV', pos: 'B.I' },
    { nr: '1140', name: 'Fertige Erzeugnisse und Waren', seite: 'AKTIV', pos: 'B.I' },
    { nr: '1180', name: 'Geleistete Anzahlungen auf Vorräte', seite: 'AKTIV', pos: 'B.I' },
    /* Forderungen und sonstige Vermögensgegenstände -> B.II */
    { nr: '1200', name: 'Forderungen aus Lieferungen und Leistungen', seite: 'AKTIV', pos: 'B.II' },
    { nr: '1240', name: 'Zweifelhafte Forderungen', seite: 'AKTIV', pos: 'B.II' },
    { nr: '1300', name: 'Sonstige Vermögensgegenstände', seite: 'AKTIV', pos: 'B.II' },
    { nr: '1340', name: 'Forderungen gegen Personal', seite: 'AKTIV', pos: 'B.II' },
    { nr: '1401', name: 'Abziehbare Vorsteuer 7 %', seite: 'AKTIV', pos: 'B.II' },
    { nr: '1406', name: 'Abziehbare Vorsteuer 19 %', seite: 'AKTIV', pos: 'B.II' },
    /* Wertpapiere des Umlaufvermögens -> B.III */
    { nr: '1500', name: 'Anteile an verbundenen Unternehmen (Umlaufvermögen)', seite: 'AKTIV', pos: 'B.III', vv: true },
    { nr: '1510', name: 'Sonstige Wertpapiere (Umlaufvermögen)', seite: 'AKTIV', pos: 'B.III', vv: true },
    /* Kasse / Bank -> B.IV */
    { nr: '1460', name: 'Geldtransit', seite: 'AKTIV', pos: 'B.IV' },
    { nr: '1600', name: 'Kasse', seite: 'AKTIV', pos: 'B.IV', eb: true },
    { nr: '1800', name: 'Bank (Guthaben bei Kreditinstituten)', seite: 'AKTIV', pos: 'B.IV', eb: true },
    { nr: '1810', name: 'Bank - weiteres Konto', seite: 'AKTIV', pos: 'B.IV', eb: true },
    { nr: '1820', name: 'Bank - weiteres Konto', seite: 'AKTIV', pos: 'B.IV', eb: true },
    { nr: '1830', name: 'Bank - weiteres Konto', seite: 'AKTIV', pos: 'B.IV', eb: true },
    { nr: '1840', name: 'Bank - weiteres Konto', seite: 'AKTIV', pos: 'B.IV', eb: true },
    /* Rechnungsabgrenzung / latente Steuern */
    { nr: '1900', name: 'Aktive Rechnungsabgrenzung', seite: 'AKTIV', pos: 'C' },
    { nr: '1950', name: 'Aktive latente Steuern', seite: 'AKTIV', pos: 'D' },

    /* ===== Klasse 2: Eigenkapital ===================================== */
    { nr: '2900', name: 'Gezeichnetes Kapital (Stammkapital)', seite: 'PASSIV', pos: 'P.A.I', eb: true },
    { nr: '2920', name: 'Kapitalrücklage', seite: 'PASSIV', pos: 'P.A.II', eb: true },
    { nr: '2930', name: 'Gesetzliche Rücklage', seite: 'PASSIV', pos: 'P.A.III' },
    { nr: '2950', name: 'Satzungsmäßige Rücklagen', seite: 'PASSIV', pos: 'P.A.III' },
    { nr: '2960', name: 'Andere Gewinnrücklagen', seite: 'PASSIV', pos: 'P.A.III' },
    { nr: '2970', name: 'Gewinnvortrag vor Verwendung', seite: 'PASSIV', pos: 'P.A.IV' },
    { nr: '2978', name: 'Verlustvortrag vor Verwendung', seite: 'PASSIV', pos: 'P.A.IV' },

    /* ===== Klasse 3: Rückstellungen und Verbindlichkeiten ============ */
    { nr: '3000', name: 'Rückstellungen für Pensionen und ähnliche Verpflichtungen', seite: 'PASSIV', pos: 'P.B.1' },
    { nr: '3020', name: 'Steuerrückstellungen', seite: 'PASSIV', pos: 'P.B.2' },
    { nr: '3030', name: 'Gewerbesteuerrückstellung', seite: 'PASSIV', pos: 'P.B.2' },
    { nr: '3040', name: 'Körperschaftsteuerrückstellung', seite: 'PASSIV', pos: 'P.B.2' },
    { nr: '3070', name: 'Sonstige Rückstellungen', seite: 'PASSIV', pos: 'P.B.3' },
    { nr: '3100', name: 'Anleihen', seite: 'PASSIV', pos: 'P.C.1' },
    { nr: '3150', name: 'Verbindlichkeiten gegenüber Kreditinstituten', seite: 'PASSIV', pos: 'P.C.2', vv: true },
    { nr: '3250', name: 'Erhaltene Anzahlungen auf Bestellungen', seite: 'PASSIV', pos: 'P.C.3' },
    { nr: '3300', name: 'Verbindlichkeiten aus Lieferungen und Leistungen', seite: 'PASSIV', pos: 'P.C.4' },
    { nr: '3460', name: 'Verbindlichkeiten gegenüber verbundenen Unternehmen', seite: 'PASSIV', pos: 'P.C.6' },
    { nr: '3500', name: 'Sonstige Verbindlichkeiten', seite: 'PASSIV', pos: 'P.C.8' },
    { nr: '3700', name: 'Verbindlichkeiten aus Steuern', seite: 'PASSIV', pos: 'P.C.8' },
    { nr: '3730', name: 'Verbindlichkeiten aus Lohn- und Kirchensteuer', seite: 'PASSIV', pos: 'P.C.8' },
    { nr: '3740', name: 'Verbindlichkeiten im Rahmen der sozialen Sicherheit', seite: 'PASSIV', pos: 'P.C.8' },
    { nr: '3801', name: 'Umsatzsteuer 7 %', seite: 'PASSIV', pos: 'P.C.8' },
    { nr: '3806', name: 'Umsatzsteuer 19 %', seite: 'PASSIV', pos: 'P.C.8' },
    { nr: '3065', name: 'Passive latente Steuern', seite: 'PASSIV', pos: 'P.E' },
    { nr: '3900', name: 'Passive Rechnungsabgrenzung', seite: 'PASSIV', pos: 'P.D' },

    /* ===== Klasse 4: Betriebliche Erträge ============================ */
    { nr: '4000', name: 'Umsatzerlöse', seite: 'ERTRAG', kat: 'umsatz' },
    { nr: '4300', name: 'Erlöse 7 % USt', seite: 'ERTRAG', kat: 'umsatz' },
    { nr: '4400', name: 'Erlöse 19 % USt', seite: 'ERTRAG', kat: 'umsatz' },
    { nr: '4185', name: 'Erlöse als Kleinunternehmer (steuerfrei)', seite: 'ERTRAG', kat: 'umsatz' },
    { nr: '4860', name: 'Grundstückserlöse (Vermietung und Verpachtung)', seite: 'ERTRAG', kat: 'umsatz', vv: true },
    { nr: '4800', name: 'Bestandsveränderungen', seite: 'ERTRAG', kat: 'bestand' },
    { nr: '4820', name: 'Andere aktivierte Eigenleistungen', seite: 'ERTRAG', kat: 'eigenleistung' },
    { nr: '4830', name: 'Sonstige betriebliche Erträge', seite: 'ERTRAG', kat: 'sonstertrag' },
    { nr: '4900', name: 'Erträge aus dem Abgang von Anlagevermögen', seite: 'ERTRAG', kat: 'sonstertrag', vv: true },
    { nr: '4906', name: 'Erträge aus dem Abgang von Umlaufvermögen', seite: 'ERTRAG', kat: 'sonstertrag', vv: true },

    /* ===== Klasse 5/6: Betriebliche Aufwendungen ====================== */
    { nr: '5100', name: 'Einkauf Roh-, Hilfs- und Betriebsstoffe', seite: 'AUFWAND', kat: 'material' },
    { nr: '5200', name: 'Wareneingang', seite: 'AUFWAND', kat: 'material' },
    { nr: '5900', name: 'Aufwendungen für bezogene Leistungen', seite: 'AUFWAND', kat: 'material' },
    { nr: '6000', name: 'Löhne', seite: 'AUFWAND', kat: 'personal' },
    { nr: '6020', name: 'Gehälter', seite: 'AUFWAND', kat: 'personal' },
    { nr: '6110', name: 'Gesetzliche soziale Aufwendungen', seite: 'AUFWAND', kat: 'personal' },
    { nr: '6200', name: 'Abschreibungen auf immaterielle Vermögensgegenstände', seite: 'AUFWAND', kat: 'abschreibung' },
    { nr: '6220', name: 'Abschreibungen auf Sachanlagen', seite: 'AUFWAND', kat: 'abschreibung' },
    { nr: '6221', name: 'Abschreibungen auf Gebäude', seite: 'AUFWAND', kat: 'abschreibung', vv: true },
    { nr: '6260', name: 'Sofortabschreibung geringwertiger Wirtschaftsgüter', seite: 'AUFWAND', kat: 'abschreibung' },
    { nr: '6300', name: 'Sonstige betriebliche Aufwendungen', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6310', name: 'Miete (unbewegliche Wirtschaftsgüter)', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6325', name: 'Gas, Strom, Wasser', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6345', name: 'Grundstücksaufwendungen (Instandhaltung Immobilie)', seite: 'AUFWAND', kat: 'sonstaufwand', vv: true },
    { nr: '6400', name: 'Versicherungen', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6600', name: 'Werbekosten', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6650', name: 'Reisekosten', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6800', name: 'Porto', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6805', name: 'Telefon und Internet', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6815', name: 'Bürobedarf', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6825', name: 'Rechts- und Beratungskosten', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6827', name: 'Abschluss- und Prüfungskosten', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6830', name: 'Buchführungskosten', seite: 'AUFWAND', kat: 'sonstaufwand' },
    { nr: '6855', name: 'Nebenkosten des Geldverkehrs (Bank-/Depotgebühren, Spesen)', seite: 'AUFWAND', kat: 'sonstaufwand', vv: true },
    { nr: '6900', name: 'Verluste aus dem Abgang von Anlagevermögen', seite: 'AUFWAND', kat: 'sonstaufwand', vv: true },
    { nr: '6905', name: 'Verluste aus dem Abgang von Umlaufvermögen', seite: 'AUFWAND', kat: 'sonstaufwand', vv: true },

    /* ===== Klasse 7: Finanzerträge/-aufwendungen und Steuern ========= */
    { nr: '7000', name: 'Erträge aus Beteiligungen', seite: 'ERTRAG', kat: 'beteiligungsertrag', vv: true },
    { nr: '7009', name: 'Erträge aus Beteiligungen an verbundenen Unternehmen', seite: 'ERTRAG', kat: 'beteiligungsertrag', vv: true },
    { nr: '7010', name: 'Erträge aus anderen Wertpapieren und Ausleihungen des Finanzanlagevermögens', seite: 'ERTRAG', kat: 'finanzanlageertrag', vv: true },
    { nr: '7100', name: 'Sonstige Zinsen und ähnliche Erträge', seite: 'ERTRAG', kat: 'zinsertrag', vv: true },
    { nr: '7200', name: 'Abschreibungen auf Finanzanlagen', seite: 'AUFWAND', kat: 'finanzabschreibung', vv: true },
    { nr: '7210', name: 'Abschreibungen auf Wertpapiere des Umlaufvermögens', seite: 'AUFWAND', kat: 'finanzabschreibung', vv: true },
    { nr: '7300', name: 'Zinsen und ähnliche Aufwendungen', seite: 'AUFWAND', kat: 'zinsaufwand', vv: true },
    { nr: '7600', name: 'Körperschaftsteuer', seite: 'AUFWAND', kat: 'ertragsteuer' },
    { nr: '7608', name: 'Solidaritätszuschlag', seite: 'AUFWAND', kat: 'ertragsteuer' },
    { nr: '7610', name: 'Gewerbesteuer', seite: 'AUFWAND', kat: 'ertragsteuer' },
    { nr: '7639', name: 'Anrechenbare ausländische Quellensteuer', seite: 'AUFWAND', kat: 'ertragsteuer', vv: true },
    { nr: '7685', name: 'Sonstige Steuern', seite: 'AUFWAND', kat: 'sonststeuer' },

    /* ===== Klasse 9: Vortrags- und statistische Konten =============== */
    /* Eröffnungsbilanzkonto (EBK): technisches Gegenkonto für Eröffnungs-
     * buchungen / Saldenvorträge zu Jahresbeginn. Bewusst OHNE Bilanzseite
     * (seite 'EBK') - es ist ein reines Verrechnungskonto, wird von
     * uebernehmeSalden ignoriert und erscheint nicht in der Bilanz. */
    { nr: '9000', name: 'Saldenvorträge Sachkonten (Eröffnungsbilanzkonto)', seite: 'EBK' }
  ];

  /* GuV-Kategorie -> Positions-ID je Verfahren (GKV / UKV / KLEINST).
   * Die IDs verweisen auf die Posten in positionen.js (§ 275 HGB). */
  var KAT_GUV = {
    umsatz:            { GKV: 'gkv.1',  UKV: 'ukv.1',  KLEINST: 'kst.1', label: 'Umsatzerlöse' },
    bestand:           { GKV: 'gkv.2',  UKV: 'ukv.6',  KLEINST: 'kst.2', label: 'Bestandsveränderung' },
    eigenleistung:     { GKV: 'gkv.3',  UKV: 'ukv.6',  KLEINST: 'kst.2', label: 'aktivierte Eigenleistungen' },
    sonstertrag:       { GKV: 'gkv.4',  UKV: 'ukv.6',  KLEINST: 'kst.2', label: 'sonstige betriebliche Erträge' },
    beteiligungsertrag:{ GKV: 'gkv.9',  UKV: 'ukv.8',  KLEINST: 'kst.2', label: 'Erträge aus Beteiligungen' },
    finanzanlageertrag:{ GKV: 'gkv.10', UKV: 'ukv.9',  KLEINST: 'kst.2', label: 'Erträge aus Finanzanlagen' },
    zinsertrag:        { GKV: 'gkv.11', UKV: 'ukv.10', KLEINST: 'kst.2', label: 'Zinserträge' },
    material:          { GKV: 'gkv.5',  UKV: 'ukv.2',  KLEINST: 'kst.3', label: 'Materialaufwand' },
    personal:          { GKV: 'gkv.6',  UKV: 'ukv.2',  KLEINST: 'kst.4', label: 'Personalaufwand' },
    abschreibung:      { GKV: 'gkv.7',  UKV: 'ukv.2',  KLEINST: 'kst.5', label: 'Abschreibungen' },
    finanzabschreibung:{ GKV: 'gkv.12', UKV: 'ukv.11', KLEINST: 'kst.5', label: 'Abschreibungen auf Finanzanlagen' },
    sonstaufwand:      { GKV: 'gkv.8',  UKV: 'ukv.7',  KLEINST: 'kst.6', label: 'sonstige betriebliche Aufwendungen' },
    zinsaufwand:       { GKV: 'gkv.13', UKV: 'ukv.12', KLEINST: 'kst.6', label: 'Zinsaufwendungen' },
    ertragsteuer:      { GKV: 'gkv.14', UKV: 'ukv.13', KLEINST: 'kst.7', label: 'Steuern vom Einkommen und Ertrag' },
    sonststeuer:       { GKV: 'gkv.16', UKV: 'ukv.15', KLEINST: 'kst.7', label: 'sonstige Steuern' }
  };

  /* Standard-Sachkonto je HGB-Bilanzposition für automatische
   * Eröffnungsbuchungen (Saldenvortrag). Eine HGB-Position ist gröber als
   * ein Konto - das Tool wählt hier ein repräsentatives Konto; es lässt sich
   * nach dem Übertrag im Journal frei ändern. Das gezeichnete Kapital wird
   * gesondert über Konto 2900 gebucht. */
  var EB_KONTO = {
    'A.I': '0100', 'A.II': '0500', 'A.III': '0820',
    'B.I': '1140', 'B.II': '1200', 'B.III': '1510', 'B.IV': '1800',
    'C': '1900', 'D': '1950',
    'P.A.II': '2920', 'P.A.III': '2960', 'P.A.IV': '2970',
    'P.B.1': '3000', 'P.B.2': '3020', 'P.B.3': '3070',
    'P.C.1': '3100', 'P.C.2': '3150', 'P.C.3': '3250', 'P.C.4': '3300',
    'P.C.5': '3500', 'P.C.6': '3460', 'P.C.7': '3500', 'P.C.8': '3500',
    'P.D': '3900', 'P.E': '3065'
  };

  /* Nutzerdefinierte Konten: zur Laufzeit ueber setEigene() registriert (aus
   * den Unternehmensdaten). Jeder Eintrag hat dieselbe Form wie ein KONTEN-
   * Eintrag (nr, name, seite, pos|kat) und wird aus einem Vorlage-Konto
   * abgeleitet, damit die Bilanz-/GuV-Zuordnung stimmt. */
  var eigene = [];
  function setEigene(arr) {
    eigene = (arr || []).filter(function (k) { return k && k.nr; }).map(function (k) {
      return { nr: String(k.nr), name: k.name || String(k.nr), seite: k.seite,
               pos: k.pos, kat: k.kat, vorlage: k.vorlage, eigen: true };
    });
  }
  /* Eingebaute + eigene Konten — Basis fuer alle Konto-Auswahllisten. */
  function alleKonten() { return KONTEN.concat(eigene); }

  function kontoFinden(nr) {
    var i;
    for (i = 0; i < KONTEN.length; i++) if (KONTEN[i].nr === nr) return KONTEN[i];
    for (i = 0; i < eigene.length; i++) if (eigene[i].nr === nr) return eigene[i];
    return null;
  }
  function vvKonten() {
    return KONTEN.filter(function (k) { return k.vv; });
  }

  return { KONTEN: KONTEN, KAT_GUV: KAT_GUV, EB_KONTO: EB_KONTO,
           kontoFinden: kontoFinden, vvKonten: vvKonten,
           setEigene: setEigene, alleKonten: alleKonten };
});
