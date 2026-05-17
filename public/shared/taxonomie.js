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
    'A.I.3':   'bs.ass.fixAss.intan.goodwill',
    'A.II':    'bs.ass.fixAss.tan',
    'A.II.1':  'bs.ass.fixAss.tan.landBuildings',
    'A.II.2':  'bs.ass.fixAss.tan.machinery',
    'A.II.3':  'bs.ass.fixAss.tan.otherEquipm',
    'A.III':   'bs.ass.fixAss.fin',
    'A.III.1': 'bs.ass.fixAss.fin.sharesInAffil',
    'A.III.3': 'bs.ass.fixAss.fin.particip',
    'B':       'bs.ass.currAss',
    'B.I':     'bs.ass.currAss.inventory',
    'B.I.1':   'bs.ass.currAss.inventory.material',
    'B.II':    'bs.ass.currAss.receiv',
    'B.II.1':  'bs.ass.currAss.receiv.trade',
    'B.II.2':  'bs.ass.currAss.receiv.affil',
    'B.III':   'bs.ass.currAss.securities',
    'B.IV':    'bs.ass.currAss.cashEquiv',
    'C':       'bs.ass.prepaidExp',
    'D':       'bs.ass.defTax',
    'F':       'bs.ass.deficitNotCoveredByCapital',
    /* Passiva */
    'PASSIVA_SUMME': 'bs.eqLiab',
    'P.A':       'bs.eqLiab.equity',
    'P.A.I':     'bs.eqLiab.equity.subscribed',
    'P.A.II':    'bs.eqLiab.equity.capRes',
    'P.A.III':   'bs.eqLiab.equity.revenueRes',
    'P.A.III.1': 'bs.eqLiab.equity.revenueRes.legal',
    'P.A.III.4': 'bs.eqLiab.equity.revenueRes.other',
    'P.A.IV':    'bs.eqLiab.equity.retainedEarnings',
    'P.A.V':     'bs.eqLiab.equity.netIncome',
    'P.B':       'bs.eqLiab.accruals',
    'P.B.1':     'bs.eqLiab.accruals.pensions',
    'P.B.2':     'bs.eqLiab.accruals.tax',
    'P.B.3':     'bs.eqLiab.accruals.other',
    'P.C':       'bs.eqLiab.liab',
    'P.C.2':     'bs.eqLiab.liab.bank',
    'P.C.3':     'bs.eqLiab.liab.advPaym',
    'P.C.4':     'bs.eqLiab.liab.trade',
    'P.C.6':     'bs.eqLiab.liab.assocComp',
    'P.C.8':     'bs.eqLiab.liab.other',
    'P.D':       'bs.eqLiab.defIncome',
    'P.E':       'bs.eqLiab.defTax'
  };

  /* Kapital-Sonderelemente nach § 272 Abs. 1 HGB */
  var KAPITAL = {
    'eingefordertesKapital':  'bs.eqLiab.equity.subscribed.calledIn',
    'nichtEingefordert':      'bs.eqLiab.equity.subscribed.unpaidCap'
  };

  /* GuV-Position -> de-gaap-ci-Element. 'duration' = Zeitraum. */
  var GUV = {
    'gkv.1':  'is.netIncome.regular.operatingTC.grossTradingProfit.totalOutput.netSales',
    'gkv.2':  'is.netIncome.regular.operatingTC.grossTradingProfit.totalOutput.inventoryChange',
    'gkv.3':  'is.netIncome.regular.operatingTC.grossTradingProfit.totalOutput.ownWork',
    'gkv.4':  'is.netIncome.regular.operatingTC.otherOpRevenue',
    'gkv.5':  'is.netIncome.regular.operatingTC.grossTradingProfit.materialServices.material',
    'gkv.6':  'is.netIncome.regular.operatingTC.staff',
    'gkv.7':  'is.netIncome.regular.operatingTC.deprAmort',
    'gkv.8':  'is.netIncome.regular.operatingTC.otherCost',
    'gkv.14': 'is.netIncome.tax',
    'gkv.15': 'is.netIncome.eat',
    'gkv.16': 'is.netIncome.otherTaxes',
    'gkv.17': 'is.netIncome',
    'ukv.1':  'is.netIncome.regular.operatingCOGS.grossTradingProfit.netSales',
    'ukv.13': 'is.netIncome.tax',
    'ukv.15': 'is.netIncome.otherTaxes',
    'ukv.16': 'is.netIncome',
    'kst.1':  'is.netIncome.regular.operatingTC.grossTradingProfit.totalOutput.netSales',
    'kst.8':  'is.netIncome'
  };

  function bilanzElement(posId) { return BILANZ[posId] || null; }
  function guvElement(posId) { return GUV[posId] || null; }

  return {
    VERSION: VERSION, STAND: STAND, NS: NS, SCHEMA: SCHEMA,
    BILANZ: BILANZ, KAPITAL: KAPITAL, GUV: GUV,
    bilanzElement: bilanzElement, guvElement: guvElement
  };
});
