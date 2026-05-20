/* ===========================================================================
 * importe.js  -  Parser für XML-Fremdformate: Bankimport und E-Rechnung
 * ---------------------------------------------------------------------------
 * Liest die XML-basierten Importformate ein und liefert je Format eine
 * einheitliche Vorschau-Struktur:
 *   parseCamt(xml)        CAMT.053 (ISO-20022-Kontoauszug)  -> { tx: [...] }
 *   parseIbkrFlex(xml)    Interactive-Brokers-Flex-Bericht  -> { tx: [...] }
 *   parseERechnung(xml)   XRechnung / ZUGFeRD (CII und UBL) -> { rechnung: {} }
 *   parseERechnungPdf(b)  ZUGFeRD-PDF/A-3 → XML extrahieren, dann parseERechnung
 *   bankKontoVorschlag(text, eingang)  SKR04-Gegenkonto-Heuristik
 *   isoDat(s)             Datumsnormalisierung -> 'YYYY-MM-DD'
 *
 * Ergänzt die reinen Textparser mt940.js und datev.js um die XML-Formate.
 * parseCamt / parseIbkrFlex nutzen DOMParser (browser-only). parseERechnung
 * ist auf einen eigenen Mini-XML-Tag-Finder umgestellt und läuft in Browser
 * und Node — damit ist die Funktion in der Node-Test-Suite gegenprüfbar.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Importe = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Datumshilfe: extrahiert YYYY-MM-DD aus Datumsfeldern (YYYYMMDD u. a.). */
  function isoDat(s) {
    var d = String(s || '').replace(/[^0-9]/g, '').slice(0, 8);
    return d.length === 8 ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)
                          : String(s || '').slice(0, 10);
  }

  /* Bankimport CAMT.053 (ISO 20022 Kontoauszug). Parst die XML-Datei und
   * liefert die Umsätze als [{ datum, betrag, eingang, zweck, partner }]. */
  function parseCamt(xmlText) {
    var doc;
    try { doc = new DOMParser().parseFromString(String(xmlText), 'application/xml'); }
    catch (e) { return { fehler: 'Die Datei ist kein gültiges XML.' }; }
    if (!doc || doc.getElementsByTagName('parsererror').length) {
      return { fehler: 'Die Datei ist kein gültiges XML.' };
    }
    function all(root, name) {
      var out = [], els = root.getElementsByTagName('*'), i;
      for (i = 0; i < els.length; i++) if (els[i].localName === name) out.push(els[i]);
      return out;
    }
    function first(root, name) { var a = all(root, name); return a.length ? a[0] : null; }
    function txt(el) { return el ? String(el.textContent || '').trim() : ''; }
    var ntrys = all(doc, 'Ntry');
    if (!ntrys.length) {
      return { fehler: 'Keine Umsätze (Ntry) gefunden — ist das eine CAMT.053-Datei?' };
    }
    var tx = ntrys.map(function (n) {
      var dtRoot = first(n, 'BookgDt') || first(n, 'ValDt') || n;
      return {
        datum: txt(first(dtRoot, 'Dt')).slice(0, 10),
        betrag: parseFloat(txt(first(n, 'Amt')).replace(',', '.')) || 0,
        eingang: txt(first(n, 'CdtDbtInd')) === 'CRDT',
        zweck: all(n, 'Ustrd').map(txt).join(' '),
        partner: txt(first(n, 'Nm'))
      };
    });
    return { tx: tx };
  }

  /* Broker-Import: Interactive-Brokers-Flex-XML. Liefert Trades und Cash-
   * Transaktionen als [{ datum, betrag, eingang, zweck, partner, kontoHint }]. */
  function parseIbkrFlex(xmlText) {
    var doc;
    try { doc = new DOMParser().parseFromString(String(xmlText), 'application/xml'); }
    catch (e) { return { fehler: 'Die Datei ist kein gültiges XML.' }; }
    if (!doc || doc.getElementsByTagName('parsererror').length) {
      return { fehler: 'Die Datei ist kein gültiges XML.' };
    }
    function attr(el, name) { return el && el.getAttribute ? (el.getAttribute(name) || '') : ''; }
    function tagAll(name) {
      var out = [], els = doc.getElementsByTagName('*'), i;
      for (i = 0; i < els.length; i++) if (els[i].localName === name) out.push(els[i]);
      return out;
    }
    var tx = [];
    tagAll('Trade').forEach(function (t) {
      var netCash = parseFloat(attr(t, 'netCash')) || 0;
      if (!netCash) return;
      var bs = (attr(t, 'buySell') || '').toUpperCase();
      tx.push({ datum: isoDat(attr(t, 'tradeDate') || attr(t, 'dateTime')),
        betrag: Math.abs(netCash), eingang: netCash > 0,
        zweck: (bs || 'Trade') + ' ' + attr(t, 'quantity') + ' ' + attr(t, 'symbol'),
        partner: attr(t, 'symbol'), kontoHint: '1510' });
    });
    tagAll('CashTransaction').forEach(function (c) {
      var amount = parseFloat(attr(c, 'amount')) || 0;
      if (!amount) return;
      var typ = attr(c, 'type');
      var hint = /dividend/i.test(typ) ? '7010'
        : /interest/i.test(typ) ? '7100'
        : /withhold|tax/i.test(typ) ? '7600' : '6300';
      tx.push({ datum: isoDat(attr(c, 'dateTime') || attr(c, 'settleDate') || attr(c, 'reportDate')),
        betrag: Math.abs(amount), eingang: amount > 0,
        zweck: typ + ' ' + attr(c, 'description'),
        partner: attr(c, 'symbol') || typ, kontoHint: hint });
    });
    if (!tx.length) {
      return { fehler: 'Keine Trades oder Cash-Transaktionen gefunden — ist das ein ' +
        'Interactive-Brokers-Flex-Bericht?' };
    }
    return { tx: tx };
  }

  /* Mini-XML-Tag-Finder: namespace-toleranter Zugriff auf das erste Vorkommen
   * (bzw. alle Vorkommen) eines Elements mit gegebenem local name. Reicht für
   * die wohlbekannten Strukturen von XRechnung/ZUGFeRD — kein vollwertiger
   * XML-Parser. Im Browser könnten wir DOMParser nutzen; dieselbe Implementation
   * läuft aber auch in Node, was Tests erlaubt. */
  function _rxName(n) { return String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function _xmlOpen(n) {
    return new RegExp('<(?:[A-Za-z_][\\w.\\-]*:)?' + _rxName(n) + '(?:\\s[^>]*)?(\\/?)>', 'g');
  }
  function _xmlClose(n) {
    return new RegExp('</(?:[A-Za-z_][\\w.\\-]*:)?' + _rxName(n) + '\\s*>', 'g');
  }
  function _xmlUnesc(s) {
    return String(s == null ? '' : s)
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#([0-9]+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  /* Liefert den Inner-Text (ohne Kind-Tags zu rendern) des ersten Tags mit
   * diesem local name oder null, wenn nicht gefunden. Self-Closing → ''. */
  function xmlInner(text, name) {
    if (!text) return null;
    var open = _xmlOpen(name); var m = open.exec(text);
    if (!m) return null;
    if (m[1] === '/') return '';
    var start = open.lastIndex;
    var close = _xmlClose(name); close.lastIndex = start;
    var c = close.exec(text); if (!c) return null;
    return text.slice(start, c.index);
  }
  /* Liefert nur den Textknoten (keine Sub-Tags) des ersten Tags. */
  function xmlText(text, name) {
    var inner = xmlInner(text, name);
    if (inner == null) return null;
    return _xmlUnesc(inner.replace(/<[^>]*>/g, '')).trim();
  }
  /* Liefert alle Inner-Strings (mit Sub-Tags) gleichnamiger Tags. Nicht für
   * gleichnamig verschachtelte Elemente gedacht (im Schema von XRechnung/
   * ZUGFeRD nicht relevant). */
  function xmlInnerAll(text, name) {
    var out = [];
    if (!text) return out;
    var openRe = _xmlOpen(name), closeRe = _xmlClose(name);
    var m;
    while ((m = openRe.exec(text))) {
      if (m[1] === '/') { out.push(''); continue; }
      var start = openRe.lastIndex;
      closeRe.lastIndex = start;
      var c = closeRe.exec(text);
      if (!c) break;
      out.push(text.slice(start, c.index));
      openRe.lastIndex = c.index + c[0].length;
    }
    return out;
  }
  /* Attribut eines Tags lesen (erstes Vorkommen, attributname namespace-neutral). */
  function xmlAttr(text, tagName, attrName) {
    if (!text) return null;
    var n = _rxName(tagName);
    var re = new RegExp('<(?:[A-Za-z_][\\w.\\-]*:)?' + n + '\\s[^>]*>', '');
    var m = re.exec(text); if (!m) return null;
    var a = new RegExp('(?:[A-Za-z_][\\w.\\-]*:)?' + _rxName(attrName) +
      '\\s*=\\s*"([^"]*)"').exec(m[0]);
    return a ? _xmlUnesc(a[1]) : null;
  }
  function _z(s) { return parseFloat(String(s == null ? '' : s).replace(',', '.')) || 0; }

  /* Profil-URN → Klartext-Label. Deckt die in Deutschland praktisch relevanten
   * Profile von ZUGFeRD/Factur-X (MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED)
   * und XRechnung (CIUS) in den geläufigen Versionen ab. Unbekannte Werte werden
   * unverändert durchgereicht, damit der Nutzer die Rohangabe noch sieht. */
  function _profilLabel(urn) {
    if (!urn) return '';
    var u = String(urn);
    if (/:xrechnung_3/i.test(u))                  return 'XRechnung 3.x (CIUS EN 16931)';
    if (/:xrechnung_2/i.test(u))                  return 'XRechnung 2.x (CIUS EN 16931)';
    if (/urn:cen\.eu:en16931:2017$/i.test(u))     return 'EN 16931';
    if (/factur-x\.eu:1p0:minimum/i.test(u))      return 'ZUGFeRD/Factur-X MINIMUM';
    if (/factur-x\.eu:1p0:basicwl/i.test(u))      return 'ZUGFeRD/Factur-X BASIC WL';
    if (/factur-x\.eu:1p0:basic/i.test(u))        return 'ZUGFeRD/Factur-X BASIC';
    if (/factur-x\.eu:1p0:en16931/i.test(u))      return 'ZUGFeRD/Factur-X EN 16931 (COMFORT)';
    if (/factur-x\.eu:1p0:extended/i.test(u))     return 'ZUGFeRD/Factur-X EXTENDED';
    if (/zugferd\.de:1p0:extended/i.test(u))      return 'ZUGFeRD 1.0 EXTENDED';
    if (/zugferd\.de:1p0:comfort/i.test(u))       return 'ZUGFeRD 1.0 COMFORT';
    if (/zugferd\.de:1p0:basic/i.test(u))         return 'ZUGFeRD 1.0 BASIC';
    return u;
  }

  /* Positionen aus CII (IncludedSupplyChainTradeLineItem) extrahieren. */
  function _ciiPositionen(xml) {
    var items = xmlInnerAll(xml, 'IncludedSupplyChainTradeLineItem');
    return items.map(function (li) {
      var produkt = xmlInner(li, 'SpecifiedTradeProduct') || '';
      var liefer = xmlInner(li, 'SpecifiedLineTradeDelivery') || '';
      var verein = xmlInner(li, 'SpecifiedLineTradeAgreement') || '';
      var settle = xmlInner(li, 'SpecifiedLineTradeSettlement') || '';
      var preisB = xmlInner(verein, 'NetPriceProductTradePrice') || '';
      var tax    = xmlInner(settle, 'ApplicableTradeTax') || '';
      var summ   = xmlInner(settle, 'SpecifiedTradeSettlementLineMonetarySummation') || '';
      return {
        bezeichnung: xmlText(produkt, 'Name') || '',
        menge:       _z(xmlText(liefer, 'BilledQuantity')),
        einheit:     xmlAttr(liefer, 'BilledQuantity', 'unitCode') || '',
        einzelpreis: _z(xmlText(preisB, 'ChargeAmount')),
        netto:       _z(xmlText(summ, 'LineTotalAmount')),
        ustSatz:     _z(xmlText(tax, 'RateApplicablePercent'))
      };
    });
  }

  /* Positionen aus UBL (cac:InvoiceLine bzw. CreditNoteLine) extrahieren. */
  function _ublPositionen(xml) {
    var items = xmlInnerAll(xml, 'InvoiceLine');
    if (!items.length) items = xmlInnerAll(xml, 'CreditNoteLine');
    return items.map(function (li) {
      var item = xmlInner(li, 'Item') || '';
      var preisB = xmlInner(li, 'Price') || '';
      var taxCat = xmlInner(item, 'ClassifiedTaxCategory') || '';
      return {
        bezeichnung: xmlText(item, 'Name') || '',
        menge:       _z(xmlText(li, 'InvoicedQuantity') || xmlText(li, 'CreditedQuantity')),
        einheit:     xmlAttr(li, 'InvoicedQuantity', 'unitCode') ||
                     xmlAttr(li, 'CreditedQuantity', 'unitCode') || '',
        einzelpreis: _z(xmlText(preisB, 'PriceAmount')),
        netto:       _z(xmlText(li, 'LineExtensionAmount')),
        ustSatz:     _z(xmlText(taxCat, 'Percent'))
      };
    });
  }

  /* Plausi-Checks: Brutto = Netto + USt (1 ct Toleranz), Summe Positionen ≈ Netto,
   * Pflichtfelder vorhanden. Liefert ein Array von Warntexten (ohne Buchungs-
   * verhinderung) — der Nutzer entscheidet, ob er trotzdem übernimmt. */
  function _plausi(r) {
    var w = [];
    if (!r.nummer)      w.push('Rechnungsnummer fehlt (§ 14 Abs. 4 Nr. 4 UStG).');
    if (!r.datum)       w.push('Rechnungsdatum fehlt (§ 14 Abs. 4 Nr. 3 UStG).');
    if (!r.verkaeufer)  w.push('Verkäufer/Rechnungssteller fehlt.');
    if (!r.netto && !r.brutto) w.push('Weder Netto- noch Bruttobetrag gefunden.');
    if (r.netto && r.brutto && Math.abs(r.brutto - r.netto - r.ust) > 0.01) {
      w.push('Brutto (' + r.brutto.toFixed(2) + ') ≠ Netto + USt (' +
        (r.netto + r.ust).toFixed(2) + ').');
    }
    if (r.positionen && r.positionen.length) {
      var sumPos = 0;
      for (var i = 0; i < r.positionen.length; i++) sumPos += r.positionen[i].netto || 0;
      if (sumPos && r.netto && Math.abs(sumPos - r.netto) > 0.02) {
        w.push('Summe der Positionen (' + sumPos.toFixed(2) +
          ') weicht vom Rechnungs-Nettobetrag (' + r.netto.toFixed(2) + ') ab.');
      }
    }
    return w;
  }

  /* E-Rechnung (XRechnung / ZUGFeRD): parst die XML einer Eingangsrechnung in
   * den Syntaxen CII (CrossIndustryInvoice) und UBL (Invoice). Liefert
   * { rechnung: { nummer, datum, verkaeufer, netto, ust, brutto, profil,
   *               positionen: [...], warnungen: [...] } }. */
  function parseERechnung(xmlText_) {
    var xml = String(xmlText_ == null ? '' : xmlText_);
    if (!/<[^>]+>/.test(xml)) {
      return { fehler: 'Die Datei ist kein gültiges XML.' };
    }
    /* Wurzelnamen lesen — entscheidet, ob CII (CrossIndustryInvoice) oder UBL
     * (Invoice/CreditNote). */
    var rootMatch = /<(?:[A-Za-z_][\w.\-]*:)?([A-Za-z_][\w.\-]*)\b/.exec(
      xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, ''));
    var rootName = rootMatch ? rootMatch[1] : '';
    var cii = /CrossIndustryInvoice/i.test(rootName);
    var r = {};
    if (cii) {
      var exch = xmlInner(xml, 'ExchangedDocument') || '';
      var ctx  = xmlInner(xml, 'ExchangedDocumentContext') || '';
      var guideline = xmlInner(ctx, 'GuidelineSpecifiedDocumentContextParameter') || '';
      var sellerParty = xmlInner(xml, 'SellerTradeParty') || '';
      r.nummer     = xmlText(exch, 'ID') || '';
      r.datum      = isoDat(xmlText(exch, 'DateTimeString') || '');
      r.netto      = _z(xmlText(xml, 'TaxBasisTotalAmount'));
      r.ust        = _z(xmlText(xml, 'TaxTotalAmount'));
      r.brutto     = _z(xmlText(xml, 'GrandTotalAmount'));
      r.verkaeufer = xmlText(sellerParty, 'Name') || '';
      r.profil     = _profilLabel(xmlText(guideline, 'ID'));
      r.positionen = _ciiPositionen(xml);
    } else {
      var invInner = xmlInner(xml, 'Invoice') || xmlInner(xml, 'CreditNote') || xml;
      var supplier = xmlInner(invInner, 'AccountingSupplierParty') || '';
      var supParty = xmlInner(supplier, 'Party') || supplier;
      var legalEnt = xmlInner(supParty, 'PartyLegalEntity') || '';
      var partyName = xmlInner(supParty, 'PartyName') || '';
      r.nummer     = xmlText(invInner, 'ID') || '';
      r.datum      = isoDat(xmlText(invInner, 'IssueDate') || '');
      var legalMon = xmlInner(invInner, 'LegalMonetaryTotal') || '';
      r.netto      = _z(xmlText(legalMon, 'TaxExclusiveAmount'));
      r.ust        = _z(xmlText(xml, 'TaxAmount'));
      r.brutto     = _z(xmlText(legalMon, 'PayableAmount')) ||
                     _z(xmlText(legalMon, 'TaxInclusiveAmount'));
      r.verkaeufer = xmlText(legalEnt, 'RegistrationName') ||
                     xmlText(partyName, 'Name') || '';
      r.profil     = _profilLabel(xmlText(invInner, 'CustomizationID'));
      r.positionen = _ublPositionen(xml);
    }
    if (!r.brutto && !r.netto) {
      return { fehler: 'Keine Rechnungsbeträge gefunden — ist das eine E-Rechnung ' +
        '(XRechnung- oder ZUGFeRD-XML)?' };
    }
    if (!r.netto && r.brutto) r.netto = Math.round((r.brutto - r.ust) * 100) / 100;
    if (!r.brutto && r.netto) r.brutto = Math.round((r.netto + r.ust) * 100) / 100;
    r.warnungen = _plausi(r);
    return { rechnung: r };
  }

  /* ZUGFeRD-PDF/A-3 → eingebettete XML extrahieren, dann an parseERechnung
   * weiterreichen. Erwartet Uint8Array/Buffer/ArrayBuffer und liefert ein
   * Promise (Entpacken läuft im Browser über DecompressionStream → async). */
  function parseERechnungPdf(buffer) {
    var Pdfa3;
    if (typeof module !== 'undefined' && module.exports) {
      try { Pdfa3 = require('./pdfa3.js'); } catch (e) { Pdfa3 = null; }
    } else { Pdfa3 = (typeof self !== 'undefined' ? self : this).Pdfa3; }
    if (!Pdfa3) {
      return Promise.resolve({ fehler: 'PDF-Anhangs-Extraktor (pdfa3.js) nicht geladen.' });
    }
    return Pdfa3.extractAttachments(buffer).then(function (res) {
      if (res.fehler && !(res.attachments && res.attachments.length)) {
        return { fehler: res.fehler };
      }
      /* Vorrangig nach den ZUGFeRD/Factur-X/XRechnung-Standarddateinamen,
       * sonst irgendeine XML-Datei nehmen. */
      var pref = /^(factur-x\.xml|zugferd-invoice\.xml|xrechnung\.xml)$/i;
      var pick = null, anyXml = null, i;
      for (i = 0; i < res.attachments.length; i++) {
        var a = res.attachments[i];
        if (pref.test(a.name)) { pick = a; break; }
        if (/\.xml$/i.test(a.name) && !anyXml) anyXml = a;
      }
      pick = pick || anyXml;
      if (!pick) {
        return { fehler: 'In der PDF wurde keine eingebettete E-Rechnungs-XML gefunden.' };
      }
      return parseERechnung(pick.text);
    });
  }

  /* Schlägt aus dem Verwendungszweck ein SKR04-Gegenkonto vor (halbautomatisch).
   * userRegeln (optional): [{ muster, konto }] - nutzerdefinierte Regeln. Sie
   * werden VOR den eingebauten Regeln geprüft (Teilstring-Treffer, Groß-/Klein-
   * schreibung wird ignoriert) und haben damit Vorrang. */
  function bankKontoVorschlag(text, eingang, userRegeln) {
    var t = String(text || ''), tl = t.toLowerCase();
    if (userRegeln && userRegeln.length) {
      for (var u = 0; u < userRegeln.length; u++) {
        var r = userRegeln[u] || {};
        var muster = String(r.muster || '').trim().toLowerCase();
        if (muster && r.konto && tl.indexOf(muster) >= 0) return r.konto;
      }
    }
    var regeln = [
      [/miete|pacht/i, '6310'], [/telekom|vodafone|\bo2\b|mobilfunk|internet|telefon|1&1/i, '6805'],
      [/hosting|server|domain|cloud|aws|hetzner/i, '6300'], [/versicherung/i, '6400'],
      [/gehalt|lohn/i, '6020'], [/sozialvers|krankenkasse|aok|tk\b/i, '6110'],
      [/finanzamt|umsatzsteuer|ust\b/i, '3700'], [/gewerbesteuer/i, '7610'],
      [/koerperschaftsteuer|körperschaftsteuer/i, '7600'], [/reise|hotel|bahn|flug/i, '6650'],
      [/anwalt|notar|steuerberat|beratung/i, '6825'], [/zins/i, eingang ? '7100' : '7300'],
      [/büro|buero|papier/i, '6815']
    ];
    for (var i = 0; i < regeln.length; i++) if (regeln[i][0].test(t)) return regeln[i][1];
    return eingang ? '4400' : '6300';
  }

  return { parseCamt: parseCamt, parseIbkrFlex: parseIbkrFlex,
           parseERechnung: parseERechnung,
           parseERechnungPdf: parseERechnungPdf,
           bankKontoVorschlag: bankKontoVorschlag,
           isoDat: isoDat };
});
