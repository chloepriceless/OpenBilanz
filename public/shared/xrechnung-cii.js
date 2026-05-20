/* ===========================================================================
 * xrechnung-cii.js  -  XRechnung 3.x / ZUGFeRD / Factur-X CII-Generator
 * ---------------------------------------------------------------------------
 * Erzeugt eine CII-XML-Datei (UN/CEFACT Cross-Industry-Invoice) im Standard
 * XRechnung 3.x (CIUS auf EN 16931). Inhaltlich identisch zu xrechnung-ubl.js,
 * nur die Syntax ist anders — UBL und CII sind die beiden gleichberechtigten
 * Auspräge­n der EN-16931-Spezifikation. CII ist die ZUGFeRD/Factur-X-Syntax
 * und wird später auch in der Hybrid-PDF eingebettet.
 *
 *   render(rechnung, eigene)  -> XML-String
 *   pruefe(rechnung, eigene)  -> identisch zu xrechnung-ubl.pruefe
 *   summen(rechnung)          -> identisch zu xrechnung-ubl.summen
 *
 * Eingabestruktur identisch zu xrechnung-ubl.js — siehe Kopf dort.
 * ========================================================================= */
(function (root, factory) {
  var UBL = (typeof module !== 'undefined' && module.exports) ?
    require('./xrechnung-ubl.js') :
    (typeof self !== 'undefined' ? self : this).XRechnungUBL;
  var api = factory(UBL);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.XRechnungCII = api;
})(typeof self !== 'undefined' ? self : this, function (UBL) {
  'use strict';

  /* CII-Customization für XRechnung 3.x: dieselbe Conformance wie UBL,
   * üblicherweise mit 'conformant' (statt 'compliant'). Mustang akzeptiert
   * beides; die KoSIT-Testsuite zeigt 'conformant' für CII-Beispiele. */
  var GUIDELINE_ID = 'urn:cen.eu:en16931:2017#conformant#urn:xoev-de:kosit:standard:xrechnung_3.0';
  var INVOICE_TYPE = '380';
  var CREDIT_TYPE  = '381';
  var CURRENCY     = 'EUR';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(s) {
    var n = parseFloat(String(s == null ? '' : s).replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function f2(n) {
    var v = Math.round((num(n) + Number.EPSILON) * 100) / 100;
    return v.toFixed(2);
  }
  function f4(n) {
    var v = Math.round((num(n) + Number.EPSILON) * 10000) / 10000;
    return v.toFixed(4);
  }
  /* ISO-Datum YYYY-MM-DD → CII-Format '102' YYYYMMDD. */
  function dt102(iso) {
    return String(iso || '').replace(/[^0-9]/g, '').slice(0, 8);
  }
  function tag(name, body, attrs) {
    var a = '';
    if (attrs) for (var k in attrs) if (attrs[k] != null && attrs[k] !== '') {
      a += ' ' + k + '="' + esc(attrs[k]) + '"';
    }
    if (body == null || body === '') return '<' + name + a + '/>';
    return '<' + name + a + '>' + body + '</' + name + '>';
  }
  function dtTag(dateIso) {
    if (!dateIso) return '';
    return tag('udt:DateTimeString', esc(dt102(dateIso)), { format: '102' });
  }

  function renderParty(p, isSeller) {
    var name = p.name || '';
    var body = '';
    body += tag('ram:Name', esc(name));
    /* Adresse */
    var addr = '';
    if (p.plz) addr += tag('ram:PostcodeCode', esc(p.plz));
    if (p.strasse) addr += tag('ram:LineOne', esc(p.strasse));
    if (p.ort) addr += tag('ram:CityName', esc(p.ort));
    addr += tag('ram:CountryID', esc(p.land || 'DE'));
    body += tag('ram:PostalTradeAddress', addr);
    /* Steuerregistrierungen: USt-ID (schemeID=VA) und/oder Steuernummer (schemeID=FC) */
    if (p.ustId) {
      body += tag('ram:SpecifiedTaxRegistration',
        tag('ram:ID', esc(String(p.ustId).replace(/\s+/g, '')), { schemeID: 'VA' }));
    }
    if (isSeller && p.stNr && !p.ustId) {
      body += tag('ram:SpecifiedTaxRegistration',
        tag('ram:ID', esc(p.stNr), { schemeID: 'FC' }));
    }
    return body;
  }

  function renderLines(rechnung) {
    var logik = UBL.STEUERLOGIK[rechnung.besonderheit] || UBL.STEUERLOGIK.NORMAL;
    var standard = logik.code === 'S';
    return rechnung.positionen.map(function (p, i) {
      var menge = num(p.menge);
      var preis = num(p.einzelpreis);
      var nettoP = Math.round((menge * preis + Number.EPSILON) * 100) / 100;
      var satz = standard ? num(p.ustSatz) : 0;
      var einheit = String(p.einheit || 'C62');
      var body = '';
      body += tag('ram:AssociatedDocumentLineDocument',
        tag('ram:LineID', String(i + 1)));
      var produkt = tag('ram:Name', esc(p.bezeichnung || ''));
      if (p.beschreibung) produkt += tag('ram:Description', esc(p.beschreibung));
      body += tag('ram:SpecifiedTradeProduct', produkt);
      body += tag('ram:SpecifiedLineTradeAgreement',
        tag('ram:NetPriceProductTradePrice',
          tag('ram:ChargeAmount', f4(preis))));
      body += tag('ram:SpecifiedLineTradeDelivery',
        tag('ram:BilledQuantity', f4(menge), { unitCode: esc(einheit) }));
      body += tag('ram:SpecifiedLineTradeSettlement',
        tag('ram:ApplicableTradeTax',
          tag('ram:TypeCode', 'VAT') +
          tag('ram:CategoryCode', logik.code) +
          tag('ram:RateApplicablePercent', f2(satz))) +
        tag('ram:SpecifiedTradeSettlementLineMonetarySummation',
          tag('ram:LineTotalAmount', f2(nettoP))));
      return tag('ram:IncludedSupplyChainTradeLineItem', body);
    }).join('');
  }

  function renderHeaderTax(rechnung) {
    var s = UBL.summen(rechnung);
    return Object.keys(s.agg.gruppen).map(function (k) {
      var g = s.agg.gruppen[k];
      var inner = '';
      inner += tag('ram:CalculatedAmount', f2(g.ust));
      inner += tag('ram:TypeCode', 'VAT');
      if (s.agg.logik.hinweis) {
        inner += tag('ram:ExemptionReason', esc(s.agg.logik.hinweis));
      }
      inner += tag('ram:BasisAmount', f2(g.netto));
      inner += tag('ram:CategoryCode', s.agg.logik.code);
      inner += tag('ram:RateApplicablePercent', f2(g.satz));
      return tag('ram:ApplicableTradeTax', inner);
    }).join('');
  }

  function renderPayment(rechnung, eigene) {
    var b = (eigene && eigene.bank) || {};
    if (!b.iban) return '';
    var inner = '';
    inner += tag('ram:TypeCode', '58');
    /* PayeePartyCreditorFinancialAccount enthält IBAN + optional BIC. */
    var acc = tag('ram:IBANID', esc(b.iban.replace(/\s+/g, '')));
    inner += tag('ram:PayeePartyCreditorFinancialAccount', acc);
    if (b.bic) {
      inner += tag('ram:PayeeSpecifiedCreditorFinancialInstitution',
        tag('ram:BICID', esc(b.bic)));
    }
    return tag('ram:SpecifiedTradeSettlementPaymentMeans', inner);
  }

  function render(rechnung, eigene) {
    if (!rechnung) throw new Error('Rechnung fehlt.');
    if (!eigene)   throw new Error('Eigene Angaben fehlen.');
    var k = rechnung.kundeSnapshot || {};
    var s = UBL.summen(rechnung);
    var typeCode = rechnung.art === 'GUTSCHRIFT' ? CREDIT_TYPE : INVOICE_TYPE;

    var head = '<?xml version="1.0" encoding="UTF-8"?>\n';
    head += '<rsm:CrossIndustryInvoice' +
      ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"' +
      ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
      ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">';

    /* Kontext */
    var ctx = tag('ram:GuidelineSpecifiedDocumentContextParameter',
      tag('ram:ID', esc(GUIDELINE_ID)));
    head += tag('rsm:ExchangedDocumentContext', ctx);

    /* ExchangedDocument */
    var doc = '';
    doc += tag('ram:ID', esc(rechnung.nummer || ''));
    doc += tag('ram:TypeCode', typeCode);
    doc += tag('ram:IssueDateTime', dtTag(rechnung.datum));
    /* Note: Steuerhinweis + freier Hinweis */
    var noteText = '';
    var hinweis = (UBL.STEUERLOGIK[rechnung.besonderheit] || {}).hinweis;
    if (hinweis) noteText = hinweis;
    if (rechnung.hinweis) noteText += (noteText ? ' ' : '') + rechnung.hinweis;
    if (noteText) {
      doc += tag('ram:IncludedNote', tag('ram:Content', esc(noteText)));
    }
    head += tag('rsm:ExchangedDocument', doc);

    /* SupplyChainTradeTransaction */
    var sct = '';
    sct += renderLines(rechnung);
    /* HeaderTradeAgreement: Verkäufer, Käufer, BuyerReference, OrderReference */
    var agr = '';
    agr += tag('ram:BuyerReference', esc(rechnung.leitwegId || k.name || ''));
    agr += tag('ram:SellerTradeParty', renderParty(eigene, true));
    agr += tag('ram:BuyerTradeParty',  renderParty(k, false));
    if (rechnung.bestellnr) {
      agr += tag('ram:BuyerOrderReferencedDocument',
        tag('ram:IssuerAssignedID', esc(rechnung.bestellnr)));
    }
    sct += tag('ram:ApplicableHeaderTradeAgreement', agr);
    /* HeaderTradeDelivery: Leistungsdatum oder -zeitraum */
    var deliv = '';
    if (rechnung.leistungsdatum) {
      deliv += tag('ram:ActualDeliverySupplyChainEvent',
        tag('ram:OccurrenceDateTime', dtTag(rechnung.leistungsdatum)));
    }
    sct += tag('ram:ApplicableHeaderTradeDelivery', deliv);
    /* HeaderTradeSettlement */
    var sett = '';
    sett += tag('ram:InvoiceCurrencyCode', CURRENCY);
    sett += renderPayment(rechnung, eigene);
    sett += renderHeaderTax(rechnung);
    if (rechnung.zahlungsbedingungen || rechnung.faelligkeit) {
      var pt = '';
      if (rechnung.zahlungsbedingungen) {
        pt += tag('ram:Description', esc(rechnung.zahlungsbedingungen));
      }
      if (rechnung.faelligkeit) {
        pt += tag('ram:DueDateDateTime', dtTag(rechnung.faelligkeit));
      }
      sett += tag('ram:SpecifiedTradePaymentTerms', pt);
    }
    if (rechnung.leistungszeitraumVon && rechnung.leistungszeitraumBis) {
      sett += tag('ram:BillingSpecifiedPeriod',
        tag('ram:StartDateTime', dtTag(rechnung.leistungszeitraumVon)) +
        tag('ram:EndDateTime',   dtTag(rechnung.leistungszeitraumBis)));
    }
    /* SummationMonetarySummation */
    sett += tag('ram:SpecifiedTradeSettlementHeaderMonetarySummation',
      tag('ram:LineTotalAmount',   f2(s.netto)) +
      tag('ram:TaxBasisTotalAmount', f2(s.netto)) +
      tag('ram:TaxTotalAmount', f2(s.ust), { currencyID: CURRENCY }) +
      tag('ram:GrandTotalAmount', f2(s.brutto)) +
      tag('ram:DuePayableAmount', f2(s.brutto)));
    sct += tag('ram:ApplicableHeaderTradeSettlement', sett);

    head += tag('rsm:SupplyChainTradeTransaction', sct);
    head += '</rsm:CrossIndustryInvoice>';
    return head;
  }

  return {
    render: render,
    pruefe: UBL.pruefe,
    summen: UBL.summen,
    GUIDELINE_ID: GUIDELINE_ID
  };
});
