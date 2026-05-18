/* ===========================================================================
 * importe.js  -  Parser für XML-Fremdformate: Bankimport und E-Rechnung
 * ---------------------------------------------------------------------------
 * Liest die XML-basierten Importformate ein und liefert je Format eine
 * einheitliche Vorschau-Struktur:
 *   parseCamt(xml)       CAMT.053 (ISO-20022-Kontoauszug)  -> { tx: [...] }
 *   parseIbkrFlex(xml)   Interactive-Brokers-Flex-Bericht  -> { tx: [...] }
 *   parseERechnung(xml)  XRechnung / ZUGFeRD (CII und UBL) -> { rechnung: {} }
 *   bankKontoVorschlag(text, eingang)  SKR04-Gegenkonto-Heuristik
 *   isoDat(s)            Datumsnormalisierung -> 'YYYY-MM-DD'
 *
 * Ergänzt die reinen Textparser mt940.js und datev.js um die XML-Formate.
 * Browser-Modul: nutzt DOMParser und läuft daher nicht in Node (wie auch
 * validate-browser.js).
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

  /* E-Rechnung (XRechnung / ZUGFeRD): parst die XML einer Eingangsrechnung in
   * den Syntaxen CII (CrossIndustryInvoice) und UBL (Invoice). Liefert
   * { rechnung: { nummer, datum, verkaeufer, netto, ust, brutto } }. */
  function parseERechnung(xmlText) {
    var doc;
    try { doc = new DOMParser().parseFromString(String(xmlText), 'application/xml'); }
    catch (e) { return { fehler: 'Die Datei ist kein gültiges XML.' }; }
    if (!doc || doc.getElementsByTagName('parsererror').length) {
      return { fehler: 'Die Datei ist kein gültiges XML.' };
    }
    var alle = doc.getElementsByTagName('*'), i;
    function ersterText(name) {
      for (i = 0; i < alle.length; i++) if (alle[i].localName === name) {
        return String(alle[i].textContent || '').trim();
      }
      return '';
    }
    function innerhalb(rootName, childName) {
      var root = null, j;
      for (j = 0; j < alle.length; j++) if (alle[j].localName === rootName) { root = alle[j]; break; }
      if (!root) return '';
      var ch = root.getElementsByTagName('*');
      for (j = 0; j < ch.length; j++) if (ch[j].localName === childName) {
        return String(ch[j].textContent || '').trim();
      }
      return '';
    }
    function z(s) { return parseFloat(String(s || '').replace(',', '.')) || 0; }
    var root = doc.documentElement ? doc.documentElement.localName : '';
    var cii = /CrossIndustryInvoice/i.test(root);
    var r = {};
    if (cii) {
      r.nummer = innerhalb('ExchangedDocument', 'ID');
      r.datum = isoDat(innerhalb('ExchangedDocument', 'DateTimeString'));
      r.netto = z(ersterText('TaxBasisTotalAmount'));
      r.ust = z(ersterText('TaxTotalAmount'));
      r.brutto = z(ersterText('GrandTotalAmount'));
      r.verkaeufer = innerhalb('SellerTradeParty', 'Name');
    } else {
      r.nummer = innerhalb('Invoice', 'ID');
      r.datum = isoDat(ersterText('IssueDate'));
      r.netto = z(ersterText('TaxExclusiveAmount'));
      r.ust = z(ersterText('TaxAmount'));
      r.brutto = z(ersterText('PayableAmount')) || z(ersterText('TaxInclusiveAmount'));
      r.verkaeufer = innerhalb('AccountingSupplierParty', 'RegistrationName') ||
                     innerhalb('AccountingSupplierParty', 'Name');
    }
    if (!r.brutto && !r.netto) {
      return { fehler: 'Keine Rechnungsbeträge gefunden — ist das eine E-Rechnung ' +
        '(XRechnung- oder ZUGFeRD-XML)?' };
    }
    if (!r.netto && r.brutto) r.netto = Math.round((r.brutto - r.ust) * 100) / 100;
    if (!r.brutto && r.netto) r.brutto = Math.round((r.netto + r.ust) * 100) / 100;
    return { rechnung: r };
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
           parseERechnung: parseERechnung, bankKontoVorschlag: bankKontoVorschlag,
           isoDat: isoDat };
});
