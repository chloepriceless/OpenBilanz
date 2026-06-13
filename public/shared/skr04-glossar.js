/* ===========================================================================
 * skr04-glossar.js  -  Eigene Kurzerklärungen zu SKR04-Konten (Konten-Glossar)
 * ---------------------------------------------------------------------------
 * Je Konto eine EIGENE, kurz gehaltene Praxiserklärung: Wofür ist das Konto da,
 * wann bucht man es, worauf ist zu achten - gestützt auf die Rechtsgrundlagen
 * (HGB/UStG/AO/GmbHG), NICHT übernommen aus fremden Kontenbeschreibungen
 * (Copyright: nur Kontonummern und amtliche Kurzbezeichnungen sind Fakten;
 * alle Erklärtexte hier sind Originaltexte dieses Projekts).
 *
 * Stand: Vollabdeckung der 122 kuratierten SKR04-Konten (SKR04.KONTEN) — jedes
 * bilanz-/GuV-relevante Konto hat einen eigenen Erklärtext. Der Regressionstest
 * "SKR04Glossar: Vollabdeckung" erzwingt das; neue kuratierte Konten ohne Text
 * fallen rot. Die Liste ist erweiterbar - weitere Konten einfach in TEXTE ergänzen.
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
    '1810': 'Weiteres Bankkonto der GmbH neben dem Hauptkonto 1800 — z. B. ein zweites ' +
      'Geschäftskonto, Tagesgeld- oder Rücklagenkonto. Buchungslogik identisch zu 1800 ' +
      '(Soll = Eingang, Haben = Ausgang); jedes reale Bankkonto wird getrennt geführt und ' +
      'gegen seinen eigenen Auszug abgestimmt.',
    '1820': 'Drittes Bankkonto, falls die GmbH mehrere Geschäfts- oder Anlagekonten parallel ' +
      'führt. Buchung wie 1800; ein eigenes Sachkonto je Bankverbindung hält den Bankimport ' +
      'und die Abstimmung sauber getrennt.',
    '1830': 'Weiteres Bankkonto (viertes Konto) — etwa ein zweckgebundenes Konto oder eine ' +
      'zusätzliche Bankverbindung. Saldo soll dem jeweiligen Kontoauszug entsprechen; ' +
      'Buchungslogik wie 1800.',
    '1840': 'Weiteres Bankkonto (fünftes Konto) für GmbHs mit mehreren Bankverbindungen. ' +
      'Jedes Konto bleibt ein eigenes Sachkonto, damit Eingänge und Ausgänge je Bank ' +
      'nachvollziehbar bleiben; Buchungslogik wie 1800.',
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
    '2930': 'Gesetzliche Rücklage. Für die typische GmbH gibt es keine allgemeine Pflicht wie ' +
      'bei der Aktiengesellschaft; das Konto wird nur genutzt, wenn Gesetz, Satzung oder ein ' +
      'Sonderfall tatsächlich eine solche Rücklage verlangen.',
    '2960': 'Andere Gewinnrücklagen aus einbehaltenen Gewinnen. Die Bildung setzt eine ' +
      'Ergebnisverwendung durch die Gesellschafter voraus; sie mindert nicht den Gewinn des ' +
      'Jahres, sondern verschiebt Eigenkapital innerhalb der Passivseite.',
    '2950': 'Satzungsmäßige Rücklage — eine Gewinnrücklage, die der Gesellschaftsvertrag ' +
      '(die Satzung) selbst vorschreibt. Anders als die gesetzliche Rücklage (2930) beruht ' +
      'sie auf einer freiwillig in die Satzung aufgenommenen Bindung; Bildung und Auflösung ' +
      'folgen den Satzungsregeln. Teil der Gewinnrücklagen (§ 266 Abs. 3 A.III HGB), ' +
      'verschiebt Eigenkapital innerhalb der Passivseite.',
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
    '0100': 'Entgeltlich erworbene Rechte wie Lizenzen, Marken- oder Nutzungsrechte. Sie ' +
      'gehören zu den immateriellen Vermögensgegenständen (§ 266 Abs. 2 A.I HGB) und werden ' +
      'aktiviert, wenn die GmbH dafür bezahlt hat; laufende Nutzungsgebühren bleiben Aufwand.',
    '0143': 'Selbst geschaffene immaterielle Vermögensgegenstände, z. B. eigene Software. ' +
      'Für Entwicklungskosten besteht ein Aktivierungswahlrecht (§ 248 Abs. 2 HGB); reine ' +
      'Forschungskosten dürfen nicht aktiviert werden. Wer aktiviert, dokumentiert Nutzungsdauer ' +
      'und Abschreibung nachvollziehbar.',
    '0150': 'Entgeltlich erworbener Geschäfts- oder Firmenwert aus einem Unternehmenskauf. ' +
      'Nur ein gekaufter Goodwill darf aktiviert werden (§ 246 Abs. 1 S. 4 HGB); ein selbst ' +
      'geschaffener Firmenwert bleibt verboten. Planmäßige Abschreibung ist Pflicht (§ 253 HGB).',
    '0170': 'Anzahlungen auf immaterielle Vermögensgegenstände, etwa Vorauszahlungen für eine ' +
      'noch nicht gelieferte Lizenz. Bis zur Lieferung steht hier ein Anspruch; nach Lieferung ' +
      'wird auf das passende Immaterielle-Anlagekonto umgebucht.',
    '0500': 'Betriebs- und Geschäftsausstattung: Möbel, Geräte, Werkstatt- und Ladeneinrichtung. ' +
      'Aktivieren und über die Nutzungsdauer abschreiben (§ 253 Abs. 3 HGB).',
    '0520': 'Firmenfahrzeuge (Pkw) im Anlagevermögen. Anschaffungskosten aktivieren, Nutzungs' +
      'dauer üblich 6 Jahre. Bei privater Nutzung durch Gesellschafter-Geschäftsführer an ' +
      '1-%-Regel bzw. Fahrtenbuch denken.',
    '0540': 'Lastkraftwagen und Nutzfahrzeuge im Anlagevermögen — getrennt von Pkw (0520), ' +
      'weil Nutzungsdauer und steuerliche Behandlung abweichen (bei Lkw kein 1-%-Ansatz, da ' +
      'keine typische Privatnutzung). Anschaffungskosten aktivieren und planmäßig abschreiben ' +
      '(§ 253 Abs. 3 HGB).',
    '0200': 'Grundstücke, grundstücksgleiche Rechte und Bauten als Sammelkonto des Sachanlage' +
      'vermögens. Grundstück und Gebäude sollten praktisch getrennt dokumentiert werden, weil ' +
      'nur das Gebäude planmäßig abgeschrieben wird; Grund und Boden regelmäßig nicht.',
    '0215': 'Unbebaute Grundstücke — Grund und Boden ohne Gebäude. Wie der Bodenanteil ' +
      'bebauter Grundstücke nicht abnutzbar und daher nicht planmäßig abzuschreiben ' +
      '(§ 253 Abs. 3 HGB betrifft abnutzbare Vermögensgegenstände); nur bei dauerhafter ' +
      'Wertminderung ist eine außerplanmäßige Abschreibung zu prüfen.',
    '0220': 'Grundstücksgleiche Rechte — Rechte, die rechtlich wie Grundstücke behandelt ' +
      'werden, etwa Erbbaurechte oder Wohnungseigentum. Ausweis im Sachanlagevermögen ' +
      '(§ 266 Abs. 2 A.II HGB); abnutzbare Rechte werden über ihre Laufzeit abgeschrieben, ' +
      'ein reiner Bodenwert nicht.',
    '0235': 'Grund und Boden eigener bebauter Grundstücke. Der nicht abnutzbare Bodenanteil ' +
      'wird getrennt vom Gebäude geführt und grundsätzlich nicht planmäßig abgeschrieben ' +
      '(§ 253 Abs. 3 HGB betrifft abnutzbare Vermögensgegenstände).',
    '0240': 'Geschäftsbauten der GmbH. Anschaffungs- oder Herstellungskosten werden aktiviert ' +
      'und über die Nutzungsdauer abgeschrieben; spätere werterhöhende Herstellungskosten ' +
      'gehören ebenfalls hierher, reine Erhaltungsaufwendungen nicht.',
    '0260': 'Andere Bauten, die nicht Geschäfts- oder Verwaltungsgebäude sind — z. B. ' +
      'Außenanlagen, Hallen, Garagen oder Aufbauten. Herstellungskosten aktivieren ' +
      '(§ 255 HGB) und über die Nutzungsdauer planmäßig abschreiben (§ 253 Abs. 3 HGB).',
    '0400': 'Technische Anlagen und Maschinen im Betrieb. Anschaffungskosten einschließlich ' +
      'Nebenkosten aktivieren (§ 255 HGB) und planmäßig abschreiben (§ 253 Abs. 3 HGB).',
    '0440': 'Maschinen als konkretisiertes Sachanlagenkonto. Wartung und Reparatur sind Aufwand; ' +
      'Anschaffung, Erweiterung oder wesentliche Verbesserung wird aktiviert und abgeschrieben.',
    '0650': 'Schreibtische, Regale, Bürotechnik und vergleichbare Einrichtung. Aktivieren und ' +
      'abschreiben; Gegenstände bis 800 € netto können sofort auf 6260 abgeschrieben werden.',
    '0670': 'Geringwertige Wirtschaftsgüter bis 800 € netto (§ 6 Abs. 2 EStG): Regelfall ist ' +
      'die SOFORT-Abschreibung als Aufwand auf 6260 (keine Aktivierung). Dieses Aktivkonto ' +
      'wird nur genutzt, wenn GWG ausnahmsweise aktiviert und planmäßig abgeschrieben werden. ' +
      'Daneben existiert das separate Sammelposten-Wahlrecht (§ 6 Abs. 2a EStG, 250–1.000 € ' +
      'netto, pauschal 5 Jahre) — das ist ein eigenes Verfahren, nicht dieses Konto.',
    '0700': 'Anlagen im Bau und Anzahlungen auf Sachanlagen. Hier werden Kosten gesammelt, ' +
      'solange das Wirtschaftsgut noch nicht betriebsbereit ist; AfA beginnt erst nach ' +
      'Fertigstellung und Umbuchung auf das endgültige Anlagekonto.',
    '0820': 'Anteile an anderen Unternehmen, die dauerhaft gehalten werden, um Einfluss oder ' +
      'Erträge zu erzielen (§ 271 Abs. 1 HGB). Kern der Beteiligungs-/Holding-GmbH; Erträge ' +
      'daraus laufen auf 7000.',
    '0800': 'Anteile an verbundenen Unternehmen. Verbunden ist ein Unternehmen regelmäßig bei ' +
      'beherrschendem Einfluss (§ 271 Abs. 2 HGB). Dauerhaft gehaltene Anteile stehen im ' +
      'Finanzanlagevermögen; Dividenden laufen auf 7009 oder 7000.',
    '0810': 'Ausleihungen an verbundene Unternehmen, also langfristige Darlehen innerhalb der ' +
      'Unternehmensgruppe. Zinsen gehören in die Finanzerträge; Laufzeit, Sicherheiten und ' +
      'Fremdüblichkeit sollten schriftlich dokumentiert sein.',
    '0850': 'Andere Beteiligungen an Kapitalgesellschaften, die dauerhaft gehalten werden, aber ' +
      'nicht die Schwelle eines verbundenen Unternehmens erreichen. Wertminderungen sind nach ' +
      '§ 253 HGB zu prüfen; Erträge daraus laufen typischerweise über Beteiligungserträge.',
    '0880': 'Ausleihungen an Unternehmen, mit denen ein Beteiligungsverhältnis besteht — ' +
      'langfristige Darlehen an Beteiligungen, die noch keine verbundenen Unternehmen sind ' +
      '(deren Ausleihungen laufen auf 0810). Finanzanlagevermögen; Zinsen sind Finanzerträge, ' +
      'Laufzeit, Sicherheiten und Fremdüblichkeit schriftlich dokumentieren.',
    '0900': 'Wertpapiere (Aktien, Fonds, Anleihen), die DAUERHAFT gehalten werden — Finanzanlage ' +
      '(Posten A.III). Kurzfristig gehaltene Papiere gehören auf 1510 (Umlaufvermögen); dort ' +
      'gilt das strenge Niederstwertprinzip (§ 253 Abs. 4 HGB).',
    '0920': 'Festverzinsliche Wertpapiere des Anlagevermögens, z. B. dauerhaft gehaltene ' +
      'Anleihen. Zinsen sind Finanzerträge; zum Stichtag sind dauerhafte Wertminderungen ' +
      'nach § 253 Abs. 3 HGB zu berücksichtigen.',

    /* ===== Forderungen / sonstige Vermögensgegenstände ================== */
    '1000': 'Roh-, Hilfs- und Betriebsstoffe im Vorratsvermögen. Sie werden bei Zugang als ' +
      'Bestand erfasst und erst bei Verbrauch oder Verkauf aufwandswirksam; am Stichtag gilt ' +
      'das Niederstwertprinzip für Umlaufvermögen (§ 253 Abs. 4 HGB).',
    '1100': 'Unfertige Erzeugnisse: begonnene, noch nicht verkaufsfertige Produkte. Die ' +
      'Herstellungskosten werden nach § 255 Abs. 2 HGB bewertet; reine Vertriebskosten gehören ' +
      'nicht in den Bestand.',
    '1110': 'Unfertige Leistungen: noch nicht abgeschlossene Dienstleistungen oder Aufträge ' +
      'zum Stichtag — das Pendant zu 1100 für Dienstleister statt Produzenten. Bewertung mit ' +
      'den Herstellungskosten (§ 255 Abs. 2 HGB); reine Vertriebskosten gehören nicht in den ' +
      'Bestand.',
    '1140': 'Fertige Erzeugnisse und Waren, die am Stichtag noch vorhanden sind. Bewertung ' +
      'höchstens mit Anschaffungs- oder Herstellungskosten; niedrigere beizulegende Werte ' +
      'müssen beim Umlaufvermögen angesetzt werden (§ 253 Abs. 4 HGB).',
    '1180': 'Geleistete Anzahlungen auf Vorräte. Solange Ware oder Material noch nicht geliefert ' +
      'ist, besteht ein Anspruch gegen den Lieferanten; nach Lieferung wird auf das passende ' +
      'Vorratskonto umgebucht.',
    '1200': 'Offene Rechnungen an Kunden (Lieferungen und Leistungen). Entsteht mit der ' +
      'Ausgangsrechnung (Soll 1200 an Erlöskonto + USt), wird beim Zahlungseingang über die ' +
      'Bank ausgeglichen. Zum Stichtag auf Werthaltigkeit prüfen (§ 252 Abs. 1 Nr. 4 HGB).',
    '1240': 'Zweifelhafte Forderungen. Nutzt man, wenn ein Kunde wahrscheinlich nicht vollständig ' +
      'zahlt. Der erwartete Ausfall wird vorsichtig bewertet (§ 252 Abs. 1 Nr. 4 HGB) und über ' +
      'Wertberichtigung oder Abschreibung verarbeitet.',
    '1300': 'Sammelposten für Forderungen, die keine Kundenforderungen sind: Kautionen, ' +
      'Steuererstattungsansprüche, Vorschüsse. Gehört in der Bilanz zu B.II ' +
      '„sonstige Vermögensgegenstände" (§ 266 Abs. 2 HGB).',
    '1340': 'Forderungen gegen Personal, z. B. Vorschüsse oder privat verauslagte Beträge, die ' +
      'Beschäftigte erstatten müssen. Zum Stichtag nur werthaltige, durchsetzbare Ansprüche ' +
      'stehen lassen; Lohnabrechnung und Verrechnung sauber dokumentieren.',
    '1406': 'Vorsteuer 19 % aus Eingangsrechnungen — die in Rechnung gestellte Umsatzsteuer, ' +
      'die die GmbH vom Finanzamt zurückbekommt (§ 15 UStG). Voraussetzung: ordnungsgemäße ' +
      'Rechnung (§ 14 UStG). Soll-Saldo; wird mit der UStVA verrechnet.',
    '1401': 'Wie 1406, aber für den ermäßigten Steuersatz 7 % (§ 12 Abs. 2 UStG) — z. B. ' +
      'Bücher, Fachzeitschriften, manche Lebensmittel.',
    '1510': 'Kurzfristig gehaltene Wertpapiere im Umlaufvermögen (B.III). Am Stichtag gilt das ' +
      'strenge Niederstwertprinzip: Liegt der Kurs unter den Anschaffungskosten, MUSS ' +
      'abgeschrieben werden (§ 253 Abs. 4 HGB, Gegenkonto 7210).',
    '1500': 'Anteile an verbundenen Unternehmen, die NICHT dauerhaft gehalten werden, sondern ' +
      'zur kurzfristigen Veräußerung bestimmt sind — daher Umlaufvermögen (B.III), nicht ' +
      'Finanzanlage (0800). Am Stichtag gilt das strenge Niederstwertprinzip ' +
      '(§ 253 Abs. 4 HGB).',

    /* ===== Rechnungsabgrenzung / latente Steuern ======================== */
    '1900': 'Ausgaben vor dem Stichtag, die Aufwand des FOLGEjahres sind (z. B. im Dezember ' +
      'bezahlte Januar-Miete oder Jahresversicherung). Aktiver Rechnungsabgrenzungsposten ' +
      '(§ 250 Abs. 1 HGB); im Folgejahr in Aufwand auflösen.',
    '1950': 'Aktive latente Steuern aus temporären Differenzen zwischen Handels- und Steuerbilanz. ' +
      'Kleine GmbHs nutzen das Konto selten; Ansatz und Bewertung folgen § 274 HGB und sollten ' +
      'bei Unsicherheit fachlich geprüft werden.',
    '3900': 'Spiegelbild zu 1900: Einnahmen vor dem Stichtag, die Ertrag des Folgejahres sind ' +
      '(z. B. im Voraus erhaltene Miete). Passiver Rechnungsabgrenzungsposten (§ 250 Abs. 2 HGB).',

    /* ===== Rückstellungen ================================================ */
    '3000': 'Pensionsrückstellungen und ähnliche langfristige Verpflichtungen gegenüber ' +
      'Beschäftigten oder Geschäftsführern. Ansatz und Bewertung sind anspruchsvoll (§ 249, ' +
      '§ 253 HGB); für kleine GmbHs meist nur mit versicherungsmathematischer Berechnung sinnvoll.',
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
    '3065': 'Passive latente Steuern aus temporären Differenzen zwischen Handels- und Steuerbilanz ' +
      '(§ 274 HGB). Das Konto ist kein Ersatz für tatsächliche Steuerverbindlichkeiten; es ' +
      'bildet künftige Steuerbelastungen aus Bewertungsunterschieden ab.',

    /* ===== Verbindlichkeiten ============================================ */
    '3100': 'Anleihen und vergleichbare verbriefte Finanzschulden. Für kleine GmbHs selten; ' +
      'Laufzeit, Zinssatz und Rückzahlungsbetrag sind für Bilanz und Anhang sauber getrennt ' +
      'zu dokumentieren.',
    '3150': 'Bankdarlehen und Kontokorrentkredite (Passivposten C.2, § 266 Abs. 3 HGB). ' +
      'Im Anhang nach Restlaufzeiten aufgliedern (§ 285 Nr. 1 HGB). Ein überzogenes ' +
      'Girokonto gehört hierher, nicht als Minus auf 1800.',
    '3250': 'Erhaltene Anzahlungen von Kunden. Die GmbH hat Geld bekommen, aber die eigene ' +
      'Leistung noch nicht vollständig erbracht; bis dahin ist es eine Verbindlichkeit ' +
      '(§ 266 Abs. 3 C.3 HGB). Umsatzsteuerliche Entstehung gesondert prüfen.',
    '3300': 'Offene Eingangsrechnungen von Lieferanten. Entsteht mit der Eingangsrechnung ' +
      '(Aufwand + Vorsteuer an 3300), Ausgleich bei Zahlung. Spiegelbild zu 1200.',
    '3460': 'Verbindlichkeiten gegenüber verbundenen Unternehmen. Darlehen, Konzernverrechnungen ' +
      'oder Lieferantenrechnungen innerhalb der Gruppe sollten getrennt ausgewiesen werden, ' +
      'weil § 266 HGB dafür einen eigenen Posten vorsieht.',
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

    /* ===== Auslandsgeschäft / Reverse-Charge (§ 13b, innergem.) ========= */
    '3837': 'Die Umsatzsteuer 19 %, die die GmbH als LEISTUNGSEMPFÄNGERIN selbst schuldet ' +
      '(Reverse-Charge, § 13b Abs. 1, 2 und 5 UStG) — typisch beim Bezug von Auslands-SaaS, ' +
      'Online-Werbung oder Gebühren ausländischer Zahlungsdienstleister. Buchung zusätzlich ' +
      'zum Aufwand: 1407 an 3837 (Steuer und Vorsteuer als Paar). Die UStVA-Karte weist den ' +
      'Saldo automatisch in Kz 47 aus (Drittlands-/Bauleistungsanteil über das Aufteilungsfeld ' +
      'nach Kz 84/85). Achtung: auch Kleinunternehmer schulden diese Steuer und müssen sie ' +
      'anmelden (§ 18 Abs. 4a UStG).',
    '1407': 'Die Gegenseite zu 3837: die nach § 13b UStG geschuldete Steuer ist bei ' +
      'Verwendung für vorsteuerunschädliche Umsätze zugleich als Vorsteuer abziehbar ' +
      '(§ 15 Abs. 1 S. 1 Nr. 4 UStG) — dann neutralisieren sich beide Buchungen. In der ' +
      'UStVA-Karte fließt der Saldo automatisch in Kz 67. Kleinunternehmer dürfen diese ' +
      'Vorsteuer NICHT abziehen (§ 15 Abs. 2 UStG).',
    '3835': 'Generisches § 13b-Steuerkonto OHNE festen Steuersatz. Besser das satzgenaue ' +
      'Konto 3837 (19 %) verwenden — Beträge auf 3835 kann die UStVA-Karte keiner ' +
      'Vordruckzeile automatisch zuordnen.',
    '1408': 'Generisches Konto für die § 13b-Vorsteuer OHNE festen Steuersatz. Besser das ' +
      'satzgenaue Konto 1407 (19 %) verwenden — Beträge auf 1408 kann die UStVA-Karte ' +
      'nicht automatisch zuordnen.',
    '3804': 'Erwerbsteuer aus dem innergemeinschaftlichen ERWERB: kauft die GmbH Waren von ' +
      'einem Unternehmer aus einem anderen EU-Staat, schuldet sie darauf selbst 19 % ' +
      'Umsatzsteuer (§ 1 Abs. 1 Nr. 5 UStG). Buchung als Paar mit der abziehbaren ' +
      'Erwerbs-Vorsteuer: 1404 an 3804. Die UStVA-Karte weist den Saldo automatisch in ' +
      'Kz 89 aus (Bemessungsgrundlage der Erwerbe). Achtung: auch Kleinunternehmer ' +
      'schulden die Erwerbsteuer und müssen sie anmelden (§ 18 Abs. 4a UStG).',
    '1404': 'Die Vorsteuer aus dem innergemeinschaftlichen Erwerb (Gegenseite zu 3804): bei ' +
      'voller Abzugsberechtigung in gleicher Höhe abziehbar (§ 15 Abs. 1 S. 1 Nr. 3 UStG), ' +
      'der Erwerb bleibt dann per Saldo steuerneutral. In der UStVA-Karte automatisch in ' +
      'Kz 61. Kleinunternehmer dürfen diese Vorsteuer NICHT abziehen (§ 15 Abs. 2 UStG).',

    /* ===== Erträge (Klasse 4 / 7) ======================================= */
    '4400': 'Standard-Erlöskonto für Lieferungen und Leistungen zum Regelsteuersatz 19 %. ' +
      'Buchung der Ausgangsrechnung: 1200 an 4400 + 3806. Nettobetrag = Umsatzerlös (§ 277 Abs. 1 HGB).',
    '4000': 'Allgemeines Umsatzerlöse-Konto (ohne Branchenzuordnung). Wirkt in OpenBilanz wie ' +
      '4400: die Erlöse zählen zu den steuerpflichtigen Umsätzen 19 % (UStVA Kz 81). Wer nur ' +
      'ein Erlöskonto braucht, nimmt einheitlich 4400.',
    '4300': 'Erlöse zum ermäßigten Steuersatz 7 % (§ 12 Abs. 2 UStG).',
    '4336': 'Erlöse aus sonstigen Leistungen an Unternehmer in anderen EU-Staaten ' +
      '(B2B-Grundregel § 3a Abs. 2 UStG): der Leistungsort liegt beim Empfänger, die Steuer ' +
      'schuldet ER in seinem Staat (Reverse-Charge). Rechnung OHNE Umsatzsteuer, mit beiden ' +
      'USt-IdNrn. und der Angabe „Steuerschuldnerschaft des Leistungsempfängers" (§ 14a ' +
      'Abs. 1 und 5 UStG). In der UStVA in Kz 21 anzugeben und in der Zusammenfassenden ' +
      'Meldung zu erklären (§§ 18a, 18b UStG) — die UStVA-Karte weist darauf hin.',
    '4337': 'Erlöse aus Leistungen IM INLAND, bei denen die Steuerschuld auf den ' +
      'Leistungsempfänger übergeht (§ 13b Abs. 2 und 5 UStG — z. B. Bauleistungen an ' +
      'bauleistende Unternehmer). Rechnung ohne Umsatzsteuer mit dem Hinweis ' +
      '„Steuerschuldnerschaft des Leistungsempfängers" (§ 14a Abs. 5 UStG); in der UStVA ' +
      'gesondert anzugeben.',
    '4338': 'Erlöse aus Leistungen, deren Leistungsort im DRITTLAND liegt — im Inland nicht ' +
      'steuerbar (Ortsregeln § 3a UStG), daher keine deutsche Umsatzsteuer. Die UStVA-Karte ' +
      'weist den Saldo automatisch in Kz 45 aus (nachrichtlich). Ob im Empfängerstaat ' +
      'Steuerpflichten entstehen, ist dort zu prüfen.',
    '4339': 'Erlöse aus Leistungen, die in einem ANDEREN EU-Staat steuerbar sind, aber NICHT ' +
      'unter die B2B-Grundregel fallen (sonst Konto 4336) — z. B. grundstücksbezogene ' +
      'Leistungen (§ 3a Abs. 3 Nr. 1 UStG). Erscheint in der UStVA-Karte in Kz 45; werden ' +
      'solche Umsätze über das OSS-Verfahren erklärt, gehören sie nicht in die Voranmeldung.',
    '4185': 'Erlöse ohne Umsatzsteuer-Ausweis als Kleinunternehmer (§ 19 UStG, Grenzen ab 2025: ' +
      '25.000 € Vorjahr / 100.000 € laufendes Jahr). Achtung: kein Vorsteuerabzug.',
    '4800': 'Bestandsveränderungen unfertiger und fertiger Erzeugnisse. Das Konto sorgt dafür, ' +
      'dass Produktion und Verbrauch periodengerecht in der GuV landen (§ 275 Abs. 2 Nr. 2 HGB).',
    '4820': 'Andere aktivierte Eigenleistungen. Eigene Arbeits- oder Materialleistungen für ' +
      'ein aktiviertes Wirtschaftsgut erhöhen dessen Herstellungskosten (§ 255 Abs. 2 HGB) ' +
      'und werden hier als Ertrag gegengebucht.',
    '4900': 'Erträge aus dem Abgang von Anlagevermögen — Gewinn beim Verkauf eines ' +
      'Anlageguts, wenn der Erlös über dem Restbuchwert liegt (Gegenstück zu 6900, dem ' +
      'Abgangsverlust). Sonstiger betrieblicher Ertrag; Restbuchwert, Erlös und Umsatzsteuer ' +
      'beim Anlagenabgang getrennt nachvollziehbar machen.',
    '4906': 'Erträge aus dem Abgang von Umlaufvermögen, z. B. realisierte Kursgewinne bei ' +
      'Wertpapieren des Umlaufvermögens (Gegenstück zu 6905). Für Trading- oder Wertpapier-' +
      'GmbHs getrennt von den laufenden Erträgen analysieren.',
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
    '7009': 'Beteiligungserträge von verbundenen Unternehmen. Inhaltlich wie 7000, aber für ' +
      'Konzern- oder Mehrheitsbeteiligungen getrennt geführt. § 8b KStG und die gewerbe' +
      'steuerliche 15-%-Grenze bleiben trotzdem gesondert zu prüfen.',
    '7010': 'Erträge aus Wertpapieren und Ausleihungen des Finanzanlagevermögens, etwa Zinsen ' +
      'aus langfristigen Darlehen oder Anleiheerträge. Nicht mit kurzfristigen Bankzinsen ' +
      'verwechseln; die Zuordnung folgt der gehaltenen Anlage.',
    '7100': 'Zinsen aus Bankguthaben, Darlehen und Verzugszinsen (GuV-Finanzergebnis).',

    /* ===== Aufwendungen (Klasse 5/6/7) ================================== */
    '5100': 'Einkauf von Roh-, Hilfs- und Betriebsstoffen. Bei Vorratsführung wird der Bestand ' +
      'zum Stichtag abgegrenzt; sofortiger Aufwand passt nur, wenn keine wesentlichen Bestände ' +
      'verbleiben.',
    '5200': 'Wareneingang für Handelswaren. Verkäufliche Ware ist am Stichtag als Vorrat zu ' +
      'erfassen; nur der verbrauchte oder verkaufte Teil gehört wirtschaftlich in den Aufwand.',
    '5900': 'Eingekaufte Fremdleistungen, die direkt in die eigene Leistung eingehen ' +
      '(Subunternehmer, Freelancer im Projekt). Materialaufwand der GuV — nicht zu ' +
      'verwechseln mit allgemeinen Verwaltungs-Dienstleistern (6300 ff.).',
    '6000': 'Löhne gewerblicher Beschäftigter. Bruttobeträge laufen in den Personalaufwand; ' +
      'einbehaltene Lohnsteuer und Sozialversicherung werden separat als Verbindlichkeiten ' +
      'geführt.',
    '6020': 'Bruttogehälter der Angestellten einschließlich Gesellschafter-Geschäftsführer ' +
      '(Personalaufwand, § 275 Abs. 2 Nr. 6 HGB). GGF-Gehalt muss dem Fremdvergleich ' +
      'standhalten, sonst droht eine verdeckte Gewinnausschüttung (§ 8 Abs. 3 KStG).',
    '6110': 'Arbeitgeberanteile zur Sozialversicherung (Renten-, Kranken-, Pflege-, ' +
      'Arbeitslosenversicherung) und Umlagen — Personalnebenkosten.',
    '6200': 'Planmäßige Abschreibungen auf immaterielle Vermögensgegenstände wie Software, ' +
      'Lizenzen oder entgeltlich erworbene Rechte. Gegenkonto ist das jeweilige Aktivkonto; ' +
      'die Nutzungsdauer muss zur Dokumentation passen.',
    '6220': 'Planmäßige Abschreibung der Sachanlagen über die Nutzungsdauer ' +
      '(§ 253 Abs. 3 HGB); steuerlich nach den amtlichen AfA-Tabellen.',
    '6221': 'Gebäudeabschreibungen. Wird für Bauten genutzt, die über viele Jahre planmäßig ' +
      'abgeschrieben werden; Grund und Boden bleibt getrennt und wird nicht planmäßig abgeschrieben.',
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
    '6345': 'Grundstücksaufwendungen wie laufende Instandhaltung, Hausgeld oder nicht aktivierungs' +
      'pflichtige Reparaturen an Immobilien. Wertsteigernde Herstellungskosten gehören dagegen ' +
      'auf das Gebäude-Aktivkonto.',
    '6400': 'Betriebliche Versicherungen: Haftpflicht, Inhalt, Cyber, D&O. Die Jahresprämie ' +
      'fürs Folgejahr gehört anteilig auf 1900 (Rechnungsabgrenzung).',
    '6600': 'Werbung und Marketing: Anzeigen, Online-Ads, Website, Messen, Werbematerial.',
    '6650': 'Geschäftsreisen der Beschäftigten: Bahn, Flug, Hotel, Verpflegungsmehraufwand ' +
      '(steuerliche Pauschalen beachten, § 9 Abs. 4a EStG).',
    '6800': 'Porto und Versandkosten. Für Warenversand, Briefe und Paketdienste; größere ' +
      'Frachtkosten im direkten Wareneinkauf können je nach Sachverhalt auch Anschaffungs' +
      'nebenkosten sein (§ 255 HGB).',
    '6805': 'Telefon-, Mobilfunk- und Internetkosten des Betriebs.',
    '6815': 'Verbrauchsmaterial im Büro: Papier, Toner, Schreibwaren, Kleinbedarf.',
    '6825': 'Honorare für Rechtsanwälte, Notare und allgemeine Beratung. Steuerberatung ' +
      'fürs laufende Mandat ebenfalls hier oder auf 6830 (Buchführung).',
    '6827': 'Kosten der Abschlusserstellung und -prüfung (Jahresabschluss, Offenlegung). ' +
      'Dafür ist zum Stichtag regelmäßig eine Rückstellung auf 3070 zu bilden (§ 249 HGB).',
    '6830': 'Laufende Buchführungs- und Lohnabrechnungskosten (Steuerberater, Software).',
    '6855': 'Kontoführungsgebühren, Depotgebühren, Transaktionsspesen — die Nebenkosten ' +
      'des Geldverkehrs. Bankzinsen gehören NICHT hierher, sondern auf 7300.',
    '6900': 'Verluste aus dem Abgang von Anlagevermögen, wenn der Verkaufserlös unter dem ' +
      'Restbuchwert liegt. Der Anlagenabgang sollte Restbuchwert, Erlös und Umsatzsteuer ' +
      'getrennt nachvollziehbar machen.',
    '6905': 'Verluste aus dem Abgang von Wertpapieren des Umlaufvermögens. Für Trading- oder ' +
      'Wertpapier-GmbHs wichtig, weil realisierte Verluste getrennt von laufenden Kosten ' +
      'analysiert werden sollten.',
    '7200': 'Abschreibungen auf Finanzanlagen, etwa dauerhafte Wertminderungen bei Beteiligungen ' +
      'oder langfristig gehaltenen Wertpapieren (§ 253 Abs. 3 HGB). Nicht mit 7210 für ' +
      'Umlauf-Wertpapiere verwechseln.',
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
    '7639': 'Anrechenbare ausländische Quellensteuer, z. B. einbehaltene Steuer auf Dividenden ' +
      'oder Zinsen. Steuerliche Anrechnung folgt § 26 KStG bzw. DBA-Regeln; Belege des ' +
      'Quellenstaats aufbewahren.',
    '7685': 'Sonstige Steuern, die nicht Körperschaftsteuer, Soli oder Gewerbesteuer sind, ' +
      'etwa Kfz-Steuer. Nicht für Umsatzsteuer-Zahllasten verwenden; diese laufen über die ' +
      'Umsatzsteuer- und Steuerverbindlichkeitskonten.',

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

  /* Durchsucht eine Kontenliste (Objekte mit nr/name) nach Glossar-Logik:
   * ohne Suchbegriff nur die Konten MIT eigener Erklärung (kompakte Übersicht),
   * mit Suchbegriff alle übergebenen Konten über Nr, Name UND Erklärtext.
   * max deckelt die Treffer (hält das DOM klein); gesamt = Trefferzahl vor
   * der Deckelung. Reine Funktion — vom Glossar UND der Buchungshilfe genutzt. */
  function suche(konten, q, max) {
    q = String(q == null ? '' : q).trim().toLowerCase();
    max = max || 80;
    var alle = (konten || []).filter(function (k) {
      var erkl = erklaerung(k.nr);
      if (!q) return !!erkl;
      return (k.nr + ' ' + (k.name || '') + ' ' + (erkl || ''))
        .toLowerCase().indexOf(q) >= 0;
    });
    return { treffer: alle.slice(0, max), gesamt: alle.length };
  }

  return { erklaerung: erklaerung, hatErklaerung: hatErklaerung, nummern: nummern,
           suche: suche };
});
