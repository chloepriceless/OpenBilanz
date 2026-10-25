/* ===========================================================================
 * taxonomie.js  -  Abbildung HGB-Positionen -> E-Bilanz-Taxonomie 6.9
 * ---------------------------------------------------------------------------
 * Ordnet jeder HGB-Bilanz-/GuV-Position das zugehoerige XBRL-Element der
 * amtlichen Kerntaxonomie (Modul "de-gaap-ci", Version 6.9, Stand 01.04.2025)
 * zu. Grundlage: offizielles Taxonomie-Paket german-gaap-taxonomy-v6.9.
 *
 * WICHTIG: Die Elementnamen wurden aus den offiziellen 6.9-XSD-Dateien
 * übernommen. Die Finanzverwaltung gibt jedes Jahr per BMF-Schreiben eine
 * neue Taxonomie heraus; bei einem Versionswechsel sind die Namespace-URI
 * und einzelne Elementnamen gegen die neue XSD (esteuer.de) zu prüfen.
 * Die erzeugte XBRL-Datei sollte vor der Übermittlung mit einem Validator
 * (z. B. Arelle) gegen die amtliche Taxonomie geprueft werden.
 *
 * BEIM VERSIONSWECHSEL (jaehrlich, neue Kerntaxonomie ~April):
 *   1. VERSION und STAND unten setzen - NS und SCHEMA leiten sich daraus ab.
 *   2. tools/setup-taxonomie.sh: Download-URL auf das neue Paket aktualisieren.
 *   3. BILANZ-, GUV- und KAPITAL-Elementnamen gegen die neue XSD abgleichen.
 *   4. Eine erzeugte XBRL-Instanz mit Arelle gegen die neue Taxonomie pruefen.
 * Die Roadmap fuehrt diesen Punkt in der regulatorischen Beobachtungsliste.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Taxonomie = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '6.9';
  var STAND = '2025-04-01';

  var NS = {
    'de-gaap-ci': 'http://www.xbrl.de/taxonomies/de-gaap-ci-' + STAND,
    'de-gcd':     'http://www.xbrl.de/taxonomies/de-gcd-' + STAND,
    'xbrli':      'http://www.xbrl.org/2003/instance',
    'link':       'http://www.xbrl.org/2003/linkbase',
    'xlink':      'http://www.w3.org/1999/xlink',
    'iso4217':    'http://www.xbrl.org/2003/iso4217',
    'xsi':        'http://www.w3.org/2001/XMLSchema-instance'
  };

  var SCHEMA = {
    gaap:         'http://www.xbrl.de/taxonomies/de-gaap-ci-' + STAND + '/de-gaap-ci-' + STAND + '-shell-fiscal.xsd',
    gaapMicro:    'http://www.xbrl.de/taxonomies/de-gaap-ci-' + STAND + '/de-gaap-ci-' + STAND + '-shell-fiscal-microbilg.xsd',
    gcd:          'http://www.xbrl.de/taxonomies/de-gcd-' + STAND + '/de-gcd-' + STAND + '-shell.xsd'
  };

  /* HGB-Position -> de-gaap-ci-Element (ohne Prefix). 'instant' = Bilanz. */
  var BILANZ = {
    /* Aktiva */
    'AKTIVA_SUMME':  'bs.ass',
    'A':       'bs.ass.fixAss',
    'A.I':     'bs.ass.fixAss.intan',
    'A.I.1':   'bs.ass.fixAss.intan.selfmade',
    'A.I.2':   'bs.ass.fixAss.intan.concessionBrands',
    'A.I.3':   'bs.ass.fixAss.intan.goodwill',
    'A.I.4':   'bs.ass.fixAss.intan.advPaym',
    'A.II':    'bs.ass.fixAss.tan',
    'A.II.1':  'bs.ass.fixAss.tan.landBuildings',
    'A.II.2':  'bs.ass.fixAss.tan.machinery',
    'A.II.3':  'bs.ass.fixAss.tan.otherEquipm',
    'A.II.4':  'bs.ass.fixAss.tan.inConstrAdvPaym',
    'A.III':   'bs.ass.fixAss.fin',
    'A.III.1': 'bs.ass.fixAss.fin.sharesInAffil',
    'A.III.2': 'bs.ass.fixAss.fin.loansToAffil',
    'A.III.3': 'bs.ass.fixAss.fin.particip',
    'A.III.4': 'bs.ass.fixAss.fin.loansToParticip',
    'A.III.5': 'bs.ass.fixAss.fin.securities',
    'A.III.6': 'bs.ass.fixAss.fin.otherLoans',
    'B':       'bs.ass.currAss',
    'B.I':     'bs.ass.currAss.inventory',
    'B.I.1':   'bs.ass.currAss.inventory.material',
    'B.I.2':   'bs.ass.currAss.inventory.inProgress',
    'B.I.3':   'bs.ass.currAss.inventory.finishedAndMerch',
    'B.I.4':   'bs.ass.currAss.inventory.advPaymPaid',
    'B.II':    'bs.ass.currAss.receiv',
    'B.II.1':  'bs.ass.currAss.receiv.trade',
    'B.II.2':  'bs.ass.currAss.receiv.affil',
    'B.II.3':  'bs.ass.currAss.receiv.particip',
    'B.II.4':  'bs.ass.currAss.receiv.other',
    'B.III':   'bs.ass.currAss.securities',
    'B.III.1': 'bs.ass.currAss.securities.affil',
    'B.III.2': 'bs.ass.currAss.securities.other',
    'B.IV':    'bs.ass.currAss.cashEquiv',
    'C':       'bs.ass.prepaidExp',
    'D':       'bs.ass.defTax',
    'E':       'bs.ass.SurplusFromOffsetting',
    'F':       'bs.ass.deficitNotCoveredByCapital',
    /* Passiva */
    'PASSIVA_SUMME': 'bs.eqLiab',
    'P.A':       'bs.eqLiab.equity',
    'P.A.I':     'bs.eqLiab.equity.subscribed',
    'P.A.II':    'bs.eqLiab.equity.capRes',
    'P.A.III':   'bs.eqLiab.equity.revenueRes',
    'P.A.III.1': 'bs.eqLiab.equity.revenueRes.legal',
    'P.A.III.2': 'bs.eqLiab.equity.revenueRes.sharesParentComp',
    'P.A.III.3': 'bs.eqLiab.equity.revenueRes.statutory',
    'P.A.III.4': 'bs.eqLiab.equity.revenueRes.other',
    'P.A.IV':    'bs.eqLiab.equity.retainedEarnings',
    'P.A.V':     'bs.eqLiab.equity.netIncome',
    'P.B':       'bs.eqLiab.accruals',
    'P.B.1':     'bs.eqLiab.accruals.pensions',
    'P.B.2':     'bs.eqLiab.accruals.tax',
    'P.B.3':     'bs.eqLiab.accruals.other',
    'P.C':       'bs.eqLiab.liab',
    'P.C.1':     'bs.eqLiab.liab.securities',
    'P.C.2':     'bs.eqLiab.liab.bank',
    'P.C.3':     'bs.eqLiab.liab.advPaym',
    'P.C.4':     'bs.eqLiab.liab.trade',
    'P.C.5':     'bs.eqLiab.liab.notes',
    'P.C.6':     'bs.eqLiab.liab.assocComp',
    'P.C.7':     'bs.eqLiab.liab.particip',
    'P.C.8':     'bs.eqLiab.liab.other',
    'P.D':       'bs.eqLiab.defIncome',
    'P.E':       'bs.eqLiab.defTax'
  };

  /* Kapital-Sonderelemente nach § 272 Abs. 1 HGB */
  var KAPITAL = {
    'eingefordertesKapital':  'bs.eqLiab.equity.subscribed.calledIn',
    'nichtEingefordert':      'bs.eqLiab.equity.subscribed.unpaidCap'
  };

  /* GuV-Position -> de-gaap-ci-Element. 'duration' = Zeitraum.
   * Jede Position des § 275 HGB braucht ein Element, auch die a/b-Unterposten:
   * eine Lücke fehlt sonst still in XBRL und Werteübersicht (Issue #3: das
   * gesamte Finanzergebnis 9.-13. fehlte). Die Kleinst-GuV (§ 275 Abs. 5) hat in
   * der Taxonomie eigene ismi.*-Elemente (calculation-incomeStatementMicroBilG). */
  var FIN = 'is.netIncome.regular.fin';
  var GKV = 'is.netIncome.regular.operatingTC';
  var UKV = 'is.netIncome.regular.operatingCOGS';
  var GUV = {
    'gkv.1':  GKV + '.grossTradingProfit.totalOutput.netSales',
    'gkv.2':  GKV + '.grossTradingProfit.totalOutput.inventoryChange',
    'gkv.3':  GKV + '.grossTradingProfit.totalOutput.ownWork',
    'gkv.4':  GKV + '.otherOpRevenue',
    'gkv.5':  GKV + '.grossTradingProfit.materialServices',
    'gkv.5a': GKV + '.grossTradingProfit.materialServices.material',
    'gkv.5b': GKV + '.grossTradingProfit.materialServices.services',
    'gkv.6':  GKV + '.staff',
    'gkv.6a': GKV + '.staff.salaries',
    'gkv.6b': GKV + '.staff.social',
    'gkv.7':  GKV + '.deprAmort',
    'gkv.7a': GKV + '.deprAmort.fixAss',
    'gkv.7b': GKV + '.deprAmort.currAss',
    'gkv.8':  GKV + '.otherCost',
    'gkv.9':  FIN + '.netParticipation.earnings',
    'gkv.10': FIN + '.netParticipation.earningSecurities',
    'gkv.11': FIN + '.netInterest.income',
    'gkv.12': FIN + '.netParticipation.amortFinanc',
    'gkv.13': FIN + '.netInterest.expenses',
    'gkv.14': 'is.netIncome.tax',
    'gkv.15': 'is.netIncome.eat',
    'gkv.16': 'is.netIncome.otherTaxes',
    'gkv.17': 'is.netIncome',
    'ukv.1':  UKV + '.grossOpProfit.netSales',
    'ukv.2':  UKV + '.grossOpProfit.cogs',
    'ukv.3':  UKV + '.grossOpProfit',
    'ukv.4':  UKV + '.salesCost',
    'ukv.5':  UKV + '.adminCost',
    'ukv.6':  UKV + '.grossOpProfit.otherRevenue',
    'ukv.7':  UKV + '.otherCost',
    'ukv.8':  FIN + '.netParticipation.earnings',
    'ukv.9':  FIN + '.netParticipation.earningSecurities',
    'ukv.10': FIN + '.netInterest.income',
    'ukv.11': FIN + '.netParticipation.amortFinanc',
    'ukv.12': FIN + '.netInterest.expenses',
    'ukv.13': 'is.netIncome.tax',
    'ukv.14': 'is.netIncome.eat',
    'ukv.15': 'is.netIncome.otherTaxes',
    'ukv.16': 'is.netIncome',
    'kst.1':  'ismi.netIncome.netSales',
    'kst.2':  'ismi.netIncome.otherOpRevenue',
    'kst.3':  'ismi.netIncome.materialServices',
    'kst.4':  'ismi.netIncome.staff',
    'kst.5':  'ismi.netIncome.deprAmort',
    'kst.6':  'ismi.netIncome.otherCost',
    'kst.7':  'ismi.netIncome.tax',
    'kst.8':  'ismi.netIncome'
  };

  /* Zwischensummen der Taxonomie ohne eigene § 275-Nummer. Ohne sie bleibt die
   * Rechenregel is.netIncome.eat = Betriebsergebnis + Finanzergebnis - Steuern
   * unvollständig und Arelle meldet calcInconsistency. 'nach' = Anzeigeposition
   * in der Werteübersicht; 'formel' wie in positionen.js. */
  var GUV_SUMMEN = {
    GKV: [
      { el: GKV + '.grossTradingProfit.totalOutput', label: 'Gesamtleistung', nach: 'gkv.3',
        formel: ['gkv.1', 'gkv.2', 'gkv.3'] },
      { el: GKV + '.grossTradingProfit', label: 'Rohergebnis', nach: 'gkv.5',
        formel: ['gkv.1', 'gkv.2', 'gkv.3', 'gkv.4', '-gkv.5'] },
      { el: GKV, label: 'Betriebsergebnis', nach: 'gkv.8',
        formel: ['gkv.1', 'gkv.2', 'gkv.3', 'gkv.4', '-gkv.5', '-gkv.6', '-gkv.7', '-gkv.8'] },
      { el: FIN, label: 'Finanz- und Beteiligungsergebnis', nach: 'gkv.13',
        formel: ['gkv.9', 'gkv.10', 'gkv.11', '-gkv.12', '-gkv.13'] }
    ],
    UKV: [
      { el: UKV, label: 'Betriebsergebnis', nach: 'ukv.7',
        formel: ['ukv.3', '-ukv.4', '-ukv.5', 'ukv.6', '-ukv.7'] },
      { el: FIN, label: 'Finanz- und Beteiligungsergebnis', nach: 'ukv.12',
        formel: ['ukv.8', 'ukv.9', 'ukv.10', '-ukv.11', '-ukv.12'] }
    ],
    KLEINST: []
  };

  /* Alle GuV-Fakten in Anzeigereihenfolge: Positionen samt a/b-Unterposten und
   * die Zwischensummen. werte = Berechnung.berechne(...).guv.werte. Unterposten
   * nur mit Betrag: ein leeres Kind neben einem direkt erfassten Elternwert
   * würde die Rechenregel des Elternelements verletzen. */
  function guvFakten(verfahren, schema, werte) {
    var w = werte || {};
    var summen = GUV_SUMMEN[verfahren] || GUV_SUMMEN.GKV;
    var out = [];
    function wert(id) { return Number(w[id]) || 0; }
    schema.forEach(function (p) {
      if (GUV[p.id]) out.push({ id: p.id, nr: p.nr, label: p.label, el: GUV[p.id], wert: wert(p.id) });
      (p.kinder || []).forEach(function (k) {
        if (GUV[k.id] && wert(k.id) !== 0) {
          out.push({ id: k.id, nr: k.nr, label: k.label, el: GUV[k.id], wert: wert(k.id), kind: true });
        }
      });
      summen.forEach(function (z) {
        if (z.nach !== p.id) return;
        var s = 0;
        z.formel.forEach(function (ref) {
          s += ref.charAt(0) === '-' ? -wert(ref.slice(1)) : wert(ref);
        });
        out.push({ id: null, nr: '', label: z.label, el: z.el, wert: Math.round(s * 100) / 100, summe: true });
      });
    });
    return out;
  }

  function bilanzElement(posId) { return BILANZ[posId] || null; }
  function guvElement(posId) { return GUV[posId] || null; }

  return {
    VERSION: VERSION, STAND: STAND, NS: NS, SCHEMA: SCHEMA,
    BILANZ: BILANZ, KAPITAL: KAPITAL, GUV: GUV, GUV_SUMMEN: GUV_SUMMEN,
    bilanzElement: bilanzElement, guvElement: guvElement, guvFakten: guvFakten
  };
});
