/* ===========================================================================
 * skr04-glossar.js  -  Eigene Kurzerklärungen zu SKR04-Konten (Konten-Glossar)
 * ---------------------------------------------------------------------------
 * Je Konto eine EIGENE, kurz gehaltene Praxiserklärung: Wofür ist das Konto da,
 * wann bucht man es, worauf ist zu achten - gestützt auf die Rechtsgrundlagen
 * (HGB/UStG/AO/GmbHG), NICHT übernommen aus fremden Kontenbeschreibungen
 * (Copyright: nur Kontonummern und amtliche Kurzbezeichnungen sind Fakten;
 * alle Erklärtexte hier sind Originaltexte dieses Projekts).
 *
 * Etappe 1: die häufigsten Konten einer kleinen / vermögensverwaltenden GmbH.
 * Die Liste ist bewusst erweiterbar - weitere Konten einfach in TEXTE ergänzen.
 *
 *   erklaerung(nr) -> String | null     eigener Erklärtext zum Konto
 *   hatErklaerung(nr) -> Boolean
 *   nummern() -> [String]               alle Konten mit eigenem Text
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SKR04Glossar = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TEXTE = {
    /* ===== Geldkonten ==================================================== */
    '1600': 'Bargeldbestand der GmbH. Jede Bareinnahme und -ausgabe läuft über dieses Konto; ' +
      'Kasseneinnahmen und -ausgaben sind TÄGLICH aufzuzeichnen (§ 146 Abs. 1 AO), und der ' +
      'Saldo muss jederzeit dem gezählten Bestand entsprechen (Kassensturzfähigkeit, gestützt ' +
      'auf § 146 AO / § 238 HGB). Ein Haben-Saldo (negative Kasse) ist ein klassischer ' +
      'Buchführungsmangel.',
    '1800': 'Geschäftskonto der GmbH bei der Bank. Soll-Buchung = Geldeingang, Haben-Buchung = ' +
      'Geldausgang. Der Saldo soll dem Kontoauszug entsprechen — Grundlage des Bankimports.',
    '1460': 'Verrechnungskonto für Geld, das zwischen eigenen Konten unterwegs ist (z. B. ' +
      'Überweisung Bank A → Bank B über den Jahreswechsel oder Bareinzahlung auf die Bank). ' +
      'Es nimmt Abgang und Eingang getrennt auf; nach beiden Buchungen ist der Saldo null. ' +
      'Ein Restsaldo am Stichtag heißt: eine Seite der Umbuchung fehlt.',

    /* ===== Eigenkapital ================================================== */
    '2900': 'Das im Gesellschaftsvertrag festgelegte Stammkapital (Nennbetrag, mindestens ' +
      '25.000 €, § 5 Abs. 1 GmbHG). Steht als gezeichnetes Kapital im Haben und bleibt ' +
      'unverändert, solange das Stammkapital nicht erhöht oder herabgesetzt wird (§ 272 Abs. 1 HGB).',
    '2910': 'Noch nicht eingeforderte ausstehende Einlagen auf das Stammkapital (Soll-Saldo). ' +
      'Sie werden offen vom gezeichneten Kapital abgesetzt — die Bilanz zeigt nur das ' +
      'eingeforderte Kapital (Nettomethode, § 272 Abs. 1 S. 2 HGB). Typische Gründungsbuchung ' +
      'bei TEILeinzahlung: Bank (eingezahlter Betrag) + 2910 (noch nicht eingeforderter Rest) ' +
      'an 2900 — bei Volleinzahlung entfällt 2910.',
    '2920': 'Zuzahlungen der GESELLSCHAFTER über das Stammkapital hinaus — ein Agio bei der ' +
      'Anteilsausgabe oder andere freiwillige Gesellschafter-Zuzahlungen (§ 272 Abs. 2 Nr. 1 ' +
      'und 4 HGB). Zuschüsse DRITTER (z. B. Fördermittel) gehören NICHT hierher, sondern in ' +
      'die Erträge. Erhöht das Eigenkapital, ohne das Stammkapital zu verändern.',
    '2970': 'Noch nicht verwendeter Gewinn aus Vorjahren. Bleibt stehen, bis die Gesellschafter' +
      'versammlung über die Verwendung beschließt — Ausschüttung, Rücklage oder erneuter ' +
      'Vortrag (§ 29 GmbHG).',
    '2978': 'Aufgelaufene, noch nicht ausgeglichene Verluste aus Vorjahren (Soll-Saldo, mindert ' +
      'das Eigenkapital). Übersteigen Verluste das gesamte Eigenkapital, entsteht der „nicht ' +
      'durch Eigenkapital gedeckte Fehlbetrag" (§ 268 Abs. 3 HGB).',
    '2980': 'ACHTUNG, Altfall-Konto: Der „Sonderposten mit Rücklageanteil" (§ 247 Abs. 3, ' +
      '§ 273 HGB a. F.) ist mit dem BilMoG 2009 für neue Sachverhalte ABGESCHAFFT - er darf ' +
      'handelsrechtlich nicht mehr neu gebildet werden, nur bestehende Alt-Posten durften ' +
      'fortgeführt werden. OpenBilanz ordnet das Konto mangels eigenem § 266-Posten den ' +
      'sonstigen Rückstellungen zu (Ausweis-Näherung). Im Zweifel nicht bebuchen, sondern ' +
      'steuerliche Rücklagen (z. B. § 6b EStG) mit dem Steuerberater abstimmen.',

    /* ===== Anlagevermögen =============================================== */
    '0135': 'Gekaufte Software und Lizenzen. Wird aktiviert und über die Nutzungsdauer ' +
      'abgeschrieben — steuerlich darf für Standardsoftware seit dem BMF-Schreiben vom ' +
      '22.02.2022 eine Nutzungsdauer von nur 1 Jahr angesetzt werden (Wahlrecht; faktisch ' +
      'Sofortabschreibung); handelsrechtlich und bei Individualsoftware gilt die tatsächliche ' +
      'Nutzungsdauer (bisher oft 3 Jahre). Selbst entwickelte Software gehört nicht hierher ' +
      '(Aktivierungswahlrecht auf 0143, § 248 Abs. 2 HGB).',
    '0500': 'Betriebs- und Geschäftsausstattung: Möbel, Geräte, Werkstatt- und Ladeneinrichtung. ' +
      'Aktivieren und über die Nutzungsdauer abschreiben (§ 253 Abs. 3 HGB).',
    '0520': 'Firmenfahrzeuge (Pkw) im Anlagevermögen. Anschaffungskosten aktivieren, Nutzungs' +
      'dauer üblich 6 Jahre. Bei privater Nutzung durch Gesellschafter-Geschäftsführer an ' +
      '1-%-Regel bzw. Fahrtenbuch denken.',
    '0650': 'Schreibtische, Regale, Bürotechnik und vergleichbare Einrichtung. Aktivieren und ' +
      'abschreiben; Gegenstände bis 800 € netto können sofort auf 6260 abgeschrieben werden.',
    '0670': 'Geringwertige Wirtschaftsgüter bis 800 € netto (§ 6 Abs. 2 EStG): Regelfall ist ' +
      'die SOFORT-Abschreibung als Aufwand auf 6260 (keine Aktivierung). Dieses Aktivkonto ' +
      'wird nur genutzt, wenn GWG ausnahmsweise aktiviert und planmäßig abgeschrieben werden. ' +
      'Daneben existiert das separate Sammelposten-Wahlrecht (§ 6 Abs. 2a EStG, 250–1.000 € ' +
      'netto, pauschal 5 Jahre) — das ist ein eigenes Verfahren, nicht dieses Konto.',
    '0820': 'Anteile an anderen Unternehmen, die dauerhaft gehalten werden, um Einfluss oder ' +
      'Erträge zu erzielen (§ 271 Abs. 1 HGB). Kern der Beteiligungs-/Holding-GmbH; Erträge ' +
      'daraus laufen auf 7000.',
    '0900': 'Wertpapiere (Aktien, Fonds, Anleihen), die DAUERHAFT gehalten werden — Finanzanlage ' +
      '(Posten A.III). Kurzfristig gehaltene Papiere gehören auf 1510 (Umlaufvermögen); dort ' +
      'gilt das strenge Niederstwertprinzip (§ 253 Abs. 4 HGB).',

    /* ===== Forderungen / sonstige Vermögensgegenstände ================== */
    '1200': 'Offene Rechnungen an Kunden (Lieferungen und Leistungen). Entsteht mit der ' +
      'Ausgangsrechnung (Soll 1200 an Erlöskonto + USt), wird beim Zahlungseingang über die ' +
      'Bank ausgeglichen. Zum Stichtag auf Werthaltigkeit prüfen (§ 252 Abs. 1 Nr. 4 HGB).',
    '1300': 'Sammelposten für Forderungen, die keine Kundenforderungen sind: Kautionen, ' +
      'Steuererstattungsansprüche, Vorschüsse. Gehört in der Bilanz zu B.II ' +
      '„sonstige Vermögensgegenstände" (§ 266 Abs. 2 HGB).',
    '1406': 'Vorsteuer 19 % aus Eingangsrechnungen — die in Rechnung gestellte Umsatzsteuer, ' +
      'die die GmbH vom Finanzamt zurückbekommt (§ 15 UStG). Voraussetzung: ordnungsgemäße ' +
      'Rechnung (§ 14 UStG). Soll-Saldo; wird mit der UStVA verrechnet.',
    '1401': 'Wie 1406, aber für den ermäßigten Steuersatz 7 % (§ 12 Abs. 2 UStG) — z. B. ' +
      'Bücher, Fachzeitschriften, manche Lebensmittel.',
    '1510': 'Kurzfristig gehaltene Wertpapiere im Umlaufvermögen (B.III). Am Stichtag gilt das ' +
      'strenge Niederstwertprinzip: Liegt der Kurs unter den Anschaffungskosten, MUSS ' +
      'abgeschrieben werden (§ 253 Abs. 4 HGB, Gegenkonto 7210).',

    /* ===== Rechnungsabgrenzung / latente Steuern ======================== */
    '1900': 'Ausgaben vor dem Stichtag, die Aufwand des FOLGEjahres sind (z. B. im Dezember ' +
      'bezahlte Januar-Miete oder Jahresversicherung). Aktiver Rechnungsabgrenzungsposten ' +
      '(§ 250 Abs. 1 HGB); im Folgejahr in Aufwand auflösen.',
    '3900': 'Spiegelbild zu 1900: Einnahmen vor dem Stichtag, die Ertrag des Folgejahres sind ' +
      '(z. B. im Voraus erhaltene Miete). Passiver Rechnungsabgrenzungsposten (§ 250 Abs. 2 HGB).',

    /* ===== Rückstellungen ================================================ */
    '3020': 'Rückstellung für noch nicht veranlagte Steuern des Geschäftsjahres ' +
      '(Körperschaftsteuer/Soli), Pflicht bei Gewinn (§ 249 Abs. 1 HGB). Buchung: ' +
      '7600/7608 an 3020; Auflösung bei Bescheid.',
    '3030': 'Rückstellung speziell für die Gewerbesteuer des laufenden Jahres ' +
      '(Gegenkonto 7610). Die GewSt ist seit 2008 keine Betriebsausgabe bei der KSt, ' +
      'mindert aber handelsrechtlich das Ergebnis.',
    '3040': 'Rückstellung speziell für die Körperschaftsteuer (Gegenkonto 7600) — wer ' +
      'KSt und GewSt getrennt halten will, nutzt 3030/3040 statt des Sammelkontos 3020.',
    '3070': 'Rückstellungen für ungewisse Verbindlichkeiten außerhalb der Steuern: ' +
      'Abschluss-/Prüfungskosten, Aufbewahrungspflichten, drohende Prozesskosten, ' +
      'unterlassene Instandhaltung (§ 249 HGB). Höhe nach vernünftiger kaufmännischer ' +
      'Beurteilung (§ 253 Abs. 1 HGB).',

    /* ===== Verbindlichkeiten ============================================ */
    '3150': 'Bankdarlehen und Kontokorrentkredite (Passivposten C.2, § 266 Abs. 3 HGB). ' +
      'Im Anhang nach Restlaufzeiten aufgliedern (§ 285 Nr. 1 HGB). Ein überzogenes ' +
      'Girokonto gehört hierher, nicht als Minus auf 1800.',
    '3300': 'Offene Eingangsrechnungen von Lieferanten. Entsteht mit der Eingangsrechnung ' +
      '(Aufwand + Vorsteuer an 3300), Ausgleich bei Zahlung. Spiegelbild zu 1200.',
    '3500': 'Sammelposten für Verbindlichkeiten, die weder Lieferanten- noch Bank- noch ' +
      'Steuerschulden sind: erhaltene Kautionen, Darlehen von Gesellschaftern, Verrechnungen ' +
      '(Passivposten C.8). Gesellschafterdarlehen im Anhang gesondert betrachten.',
    '3700': 'Geschuldete Steuern, die bereits fällig oder angemeldet sind — v. a. die ' +
      'Umsatzsteuer-Zahllast nach Voranmeldung und einbehaltene Abzugsteuern. Abgrenzung: ' +
      'noch UNGEWISSE Steuern gehören als Rückstellung auf 3020/3030/3040.',
    '3730': 'Einbehaltene Lohn- und Kirchensteuer der Beschäftigten, abzuführen bis zum 10. ' +
      'nach Ablauf des Anmeldungszeitraums (§ 41a EStG) — je nach Vorjahres-Lohnsteuersumme ' +
      'monatlich, vierteljährlich oder jährlich.',
    '3740': 'Einbehaltene und Arbeitgeber-Anteile zur Sozialversicherung, fällig an die ' +
      'Krankenkassen (drittletzter Bankarbeitstag des Monats).',
    '3806': 'Auf Ausgangsrechnungen ausgewiesene Umsatzsteuer 19 % (§ 12 Abs. 1 UStG) — ' +
      'Haben-Saldo, eine Verbindlichkeit gegenüber dem Finanzamt. Wird in der UStVA mit der ' +
      'Vorsteuer (1406/1401) verrechnet; der Rest ist die Zahllast.',
    '3801': 'Wie 3806, aber für den ermäßigten Steuersatz 7 % (§ 12 Abs. 2 UStG).',

    /* ===== Erträge (Klasse 4 / 7) ======================================= */
    '4400': 'Standard-Erlöskonto für Lieferungen und Leistungen zum Regelsteuersatz 19 %. ' +
      'Buchung der Ausgangsrechnung: 1200 an 4400 + 3806. Nettobetrag = Umsatzerlös (§ 277 Abs. 1 HGB).',
    '4300': 'Erlöse zum ermäßigten Steuersatz 7 % (§ 12 Abs. 2 UStG).',
    '4185': 'Erlöse ohne Umsatzsteuer-Ausweis als Kleinunternehmer (§ 19 UStG, Grenzen ab 2025: ' +
      '25.000 € Vorjahr / 100.000 € laufendes Jahr). Achtung: kein Vorsteuerabzug.',
    '4830': 'Betriebliche Erträge außerhalb des Kerngeschäfts: Erstattungen, Sachbezüge, ' +
      'aufgelöste Rückstellungen, Kursgewinne (GuV-Posten „sonstige betriebliche Erträge").',
    '4860': 'Miet- und Pachterlöse aus Grundbesitz — das Erlöskonto der Vermietungs-GmbH. ' +
      'Bei ausschließlicher Verwaltung eigenen Grundbesitzes an die erweiterte ' +
      'Grundstückskürzung denken (§ 9 Nr. 1 S. 2 GewStG).',
    '7000': 'Dividenden und Gewinnanteile aus Beteiligungen (Konto 0820). Für eine GmbH ' +
      'grundsätzlich zu 95 % körperschaftsteuerfrei (§ 8b Abs. 1, 5 KStG) — ABER: Liegt die ' +
      'Beteiligung zu Jahresbeginn unter 10 %, sind die Dividenden als Streubesitz VOLL ' +
      'steuerpflichtig (§ 8b Abs. 4 KStG). Für die Gewerbesteuer gilt eine eigene ' +
      '15-%-Grenze (§ 9 Nr. 2a GewStG).',
    '7100': 'Zinsen aus Bankguthaben, Darlehen und Verzugszinsen (GuV-Finanzergebnis).',

    /* ===== Aufwendungen (Klasse 5/6/7) ================================== */
    '5900': 'Eingekaufte Fremdleistungen, die direkt in die eigene Leistung eingehen ' +
      '(Subunternehmer, Freelancer im Projekt). Materialaufwand der GuV — nicht zu ' +
      'verwechseln mit allgemeinen Verwaltungs-Dienstleistern (6300 ff.).',
    '6020': 'Bruttogehälter der Angestellten einschließlich Gesellschafter-Geschäftsführer ' +
      '(Personalaufwand, § 275 Abs. 2 Nr. 6 HGB). GGF-Gehalt muss dem Fremdvergleich ' +
      'standhalten, sonst droht eine verdeckte Gewinnausschüttung (§ 8 Abs. 3 KStG).',
    '6110': 'Arbeitgeberanteile zur Sozialversicherung (Renten-, Kranken-, Pflege-, ' +
      'Arbeitslosenversicherung) und Umlagen — Personalnebenkosten.',
    '6220': 'Planmäßige Abschreibung der Sachanlagen über die Nutzungsdauer ' +
      '(§ 253 Abs. 3 HGB); steuerlich nach den amtlichen AfA-Tabellen.',
    '6260': 'Sofortabschreibung geringwertiger Wirtschaftsgüter bis 800 € netto im Jahr der ' +
      'Anschaffung — ein STEUERLICHES Wahlrecht (§ 6 Abs. 2 EStG), das bei kleinen Beträgen ' +
      'regelmäßig auch handelsrechtlich übernommen wird (Wesentlichkeit) — statt Aktivierung ' +
      'und mehrjähriger AfA.',
    '6300': 'Auffangkonto für betriebliche Aufwendungen ohne spezielleres Konto (Hosting, ' +
      'Software-Abos, Kleinmaterial). Besser spezifische Konten nutzen, wo vorhanden — ' +
      'das hält BWA und GuV aussagekräftig.',
    '6310': 'Miete und Pacht für Büro-, Lager- und Geschäftsräume inklusive fester ' +
      'Nebenkostenvorauszahlungen. Vorausgezahlte Folgejahres-Miete zum Stichtag auf 1900 abgrenzen.',
    '6325': 'Energie- und Wasserkosten der Geschäftsräume (Strom, Gas, Wasser).',
    '6400': 'Betriebliche Versicherungen: Haftpflicht, Inhalt, Cyber, D&O. Die Jahresprämie ' +
      'fürs Folgejahr gehört anteilig auf 1900 (Rechnungsabgrenzung).',
    '6600': 'Werbung und Marketing: Anzeigen, Online-Ads, Website, Messen, Werbematerial.',
    '6650': 'Geschäftsreisen der Beschäftigten: Bahn, Flug, Hotel, Verpflegungsmehraufwand ' +
      '(steuerliche Pauschalen beachten, § 9 Abs. 4a EStG).',
    '6805': 'Telefon-, Mobilfunk- und Internetkosten des Betriebs.',
    '6815': 'Verbrauchsmaterial im Büro: Papier, Toner, Schreibwaren, Kleinbedarf.',
    '6825': 'Honorare für Rechtsanwälte, Notare und allgemeine Beratung. Steuerberatung ' +
      'fürs laufende Mandat ebenfalls hier oder auf 6830 (Buchführung).',
    '6827': 'Kosten der Abschlusserstellung und -prüfung (Jahresabschluss, Offenlegung). ' +
      'Dafür ist zum Stichtag regelmäßig eine Rückstellung auf 3070 zu bilden (§ 249 HGB).',
    '6830': 'Laufende Buchführungs- und Lohnabrechnungskosten (Steuerberater, Software).',
    '6855': 'Kontoführungsgebühren, Depotgebühren, Transaktionsspesen — die Nebenkosten ' +
      'des Geldverkehrs. Bankzinsen gehören NICHT hierher, sondern auf 7300.',
    '7210': 'Abschreibung auf Wertpapiere des Umlaufvermögens (1500/1510), wenn der Kurs am ' +
      'Stichtag unter den Anschaffungskosten liegt — beim Umlaufvermögen zwingend ' +
      '(strenges Niederstwertprinzip, § 253 Abs. 4 HGB).',
    '7300': 'Zinsen und ähnliche Aufwendungen für Darlehen, Kontokorrent und ' +
      'Gesellschafterdarlehen (GuV-Finanzergebnis). Bei hohen Zinslasten die ' +
      'Zinsschranke und die gewerbesteuerliche Hinzurechnung (§ 8 Nr. 1 GewStG) beachten.',
    '7600': 'Körperschaftsteuer-Aufwand des Geschäftsjahres. Satz: 15 % bis VZ 2027, ab 2028 ' +
      'jährlich ein Prozentpunkt weniger bis 10 % ab 2032 (§ 23 Abs. 1 KStG i. d. F. des ' +
      'steuerlichen Investitionssofortprogramms 2025). Buchung meist gegen die Rückstellung ' +
      '3020/3040. KSt ist keine Betriebsausgabe im steuerlichen Sinn (§ 10 Nr. 2 KStG) — ' +
      'die Korrektur erfolgt außerbilanziell.',
    '7608': 'Solidaritätszuschlag: 5,5 % auf die festgesetzte Körperschaftsteuer.',
    '7610': 'Gewerbesteuer-Aufwand (Messzahl 3,5 % × Hebesatz der Gemeinde). Wie die KSt ' +
      'steuerlich nicht abziehbar (§ 4 Abs. 5b EStG); Rückstellung auf 3030.',

    /* ===== Vortragskonto ================================================= */
    '9000': 'Technisches Gegenkonto für die Eröffnungsbuchungen zum Jahresbeginn ' +
      '(Saldenvorträge aller Bestandskonten). Es ist KEIN Bilanzkonto: Nach vollständigem ' +
      'Vortrag aller Anfangsbestände ist der Saldo null — ein Restsaldo zeigt einen ' +
      'unvollständigen Vortrag an.'
  };

  function erklaerung(nr) {
    var t = TEXTE[String(nr)];
    return t == null ? null : t;
  }
  function hatErklaerung(nr) { return TEXTE[String(nr)] != null; }
  function nummern() { return Object.keys(TEXTE); }

  return { erklaerung: erklaerung, hatErklaerung: hatErklaerung, nummern: nummern };
});
