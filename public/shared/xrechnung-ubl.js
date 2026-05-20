/* ===========================================================================
 * xrechnung-ubl.js  -  XRechnung 3.x UBL-Generator
 * ---------------------------------------------------------------------------
 * Erzeugt eine UBL-XML-Datei (OASIS Universal Business Language) im Standard
 * XRechnung 3.x (CIUS auf EN 16931). Pflichtformat für B2B-Inland ab 2025.
 *
 *   render(rechnung, eigene)     -> XML-String
 *   pruefe(rechnung, eigene)     -> { ok, fehler:[], hinweise:[] }
 *   STEUERLOGIK[besonderheit]    -> Mapping auf UBL-TaxCategoryCode + Hinweis
 *
 * Der Renderer arbeitet ohne externe Bibliotheken — reine String-Templates
 * mit konsequent XML-eskapierten Werten.
 *
 * Eingabestruktur (Rechnung):
 *   { nummer, datum, leistungsdatum?, leistungszeitraumVon?,
 *     leistungszeitraumBis?, art ('RECHNUNG'|'GUTSCHRIFT'),
 *     kundeSnapshot: { name, strasse, plz, ort, land, ustId?, email? },
 *     bestellnr?, leitwegId?, faelligkeit?, zahlungsbedingungen?,
 *     positionen: [{ bezeichnung, menge, einheit, einzelpreis, ustSatz,
 *                    beschreibung? }],
 *     besonderheit ('NORMAL' | 'REVERSE_CHARGE_13b' | 'INNERGEM_LIEFERUNG' |
 *                   'INNERGEM_LEISTUNG' | 'KLEINUNTERNEHMER_19' |
 *                   'STEUERFREI_§4'),
 *     hinweis? }
 * Eingabestruktur (eigene Rechnungs-Angaben):
 *   { name, strasse, plz, ort, land, stNr?, ustId?,
 *     ansprechpartner?, telefon?, email?,
 *     bank? { iban, bic, institut? }, registergericht?, hrNummer? }
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.XRechnungUBL = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- Konstanten ------------------------------------------------------ */

  /* CIUS-/Profile-IDs für XRechnung 3.x (KoSIT 2024-12 / 2025). */
  var CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0';
  var PROFILE_ID       = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
  var INVOICE_TYPE     = '380';   /* Commercial invoice */
  var CREDIT_TYPE      = '381';   /* Credit note */
  var CURRENCY         = 'EUR';

  /* Steuerschalter → UBL-TaxCategoryCode (UNTDID 5305) + Klartext-Hinweis. */
  var STEUERLOGIK = {
    'NORMAL':              { code: 'S',  hinweis: '' },
    'REVERSE_CHARGE_13b':  { code: 'AE', hinweis: 'Steuerschuldnerschaft des Leistungsempfängers nach § 13b UStG.' },
    'INNERGEM_LIEFERUNG':  { code: 'K',  hinweis: 'Innergemeinschaftliche Lieferung steuerfrei nach § 4 Nr. 1 b UStG.' },
    'INNERGEM_LEISTUNG':   { code: 'AE', hinweis: 'Reverse-Charge nach § 3a Abs. 2 UStG i. V. m. Art. 196 MwStSystRL.' },
    'KLEINUNTERNEHMER_19': { code: 'E',  hinweis: 'Kein Steuerausweis nach § 19 UStG (Kleinunternehmer).' },
    'STEUERFREI_§4':       { code: 'E',  hinweis: 'Steuerfrei nach § 4 UStG.' }
  };

  /* ---- XML-Hilfen ------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(s) {
    var n = parseFloat(String(s == null ? '' : s).replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  /* Auf 2 Nachkommastellen kaufmännisch runden, als String mit Punkt. */
  function f2(n) {
    var v = Math.round((num(n) + Number.EPSILON) * 100) / 100;
    return v.toFixed(2);
  }
  function f4(n) {
    var v = Math.round((num(n) + Number.EPSILON) * 10000) / 10000;
    return v.toFixed(4);
  }
  function tag(name, body, attrs) {
    var a = '';
    if (attrs) for (var k in attrs) if (attrs[k] != null && attrs[k] !== '') {
      a += ' ' + k + '="' + esc(attrs[k]) + '"';
    }
    if (body == null || body === '') return '<' + name + a + '/>';
    return '<' + name + a + '>' + body + '</' + name + '>';
  }

  /* ---- Steuer- und Summenberechnung ------------------------------------ */

  /* Liefert das pro Steuer-Satz aufgeschlüsselte Mengengerüst. Bei den
   * Sondersteuerfällen (Reverse-Charge, §19) wird auf USt 0 % normiert. */
  function aggregiereSteuer(rechnung) {
    var logik = STEUERLOGIK[rechnung.besonderheit] || STEUERLOGIK.NORMAL;
    var standard = logik.code === 'S';
    var nachSatz = {};
    rechnung.positionen.forEach(function (p) {
      var menge = num(p.menge);
      var preis = num(p.einzelpreis);
      var nettoP = Math.round((menge * preis + Number.EPSILON) * 100) / 100;
      var satz = standard ? num(p.ustSatz) : 0;
      if (!nachSatz[satz]) nachSatz[satz] = { satz: satz, netto: 0, ust: 0 };
      nachSatz[satz].netto += nettoP;
    });
    Object.keys(nachSatz).forEach(function (k) {
      var s = nachSatz[k];
      s.netto = Math.round((s.netto + Number.EPSILON) * 100) / 100;
      s.ust   = Math.round((s.netto * s.satz + Number.EPSILON)) / 100;
    });
    return { logik: logik, gruppen: nachSatz };
  }
  function summen(rechnung) {
    var agg = aggregiereSteuer(rechnung);
    var netto = 0, ust = 0;
    Object.keys(agg.gruppen).forEach(function (k) {
      netto += agg.gruppen[k].netto;
      ust   += agg.gruppen[k].ust;
    });
    netto = Math.round((netto + Number.EPSILON) * 100) / 100;
    ust   = Math.round((ust + Number.EPSILON) * 100) / 100;
    var brutto = Math.round((netto + ust + Number.EPSILON) * 100) / 100;
    return { netto: netto, ust: ust, brutto: brutto, agg: agg };
  }

  /* ---- Pflichtcheck (§ 14 UStG + EN 16931 Mindestfelder) --------------- */

  /* USt-ID-Regex: Länderpräfix + Ziffern/Buchstaben. Strenge Prüfziffer
   * liegt im Modul ustid.js. Hier nur grobe Form. */
  var USTID_FORM = /^[A-Z]{2}[0-9A-Z]{2,12}$/;

  function pruefe(rechnung, eigene) {
    var fehler = [], hinweise = [];
    var r = rechnung || {}, e = eigene || {};
    var k = r.kundeSnapshot || {};

    if (!r.nummer) fehler.push('Rechnungsnummer fehlt (BT-1, § 14 Abs. 4 Nr. 4 UStG).');
    if (!r.datum) fehler.push('Rechnungsdatum fehlt (BT-2, § 14 Abs. 4 Nr. 3 UStG).');
    if (!r.positionen || !r.positionen.length) fehler.push('Mindestens eine Position erforderlich (BG-25).');

    /* Leistungsdatum oder -zeitraum (BT-72 oder BT-73/74) ist Pflicht. */
    if (!r.leistungsdatum && !(r.leistungszeitraumVon && r.leistungszeitraumBis)) {
      fehler.push('Leistungsdatum oder Leistungszeitraum fehlt (BT-72 / BT-73+BT-74, § 14 Abs. 4 Nr. 6 UStG).');
    }

    /* Eigene Angaben (Seller). */
    if (!e.name)       fehler.push('Eigener Firmenname fehlt (BT-27).');
    if (!e.strasse || !e.plz || !e.ort) fehler.push('Eigene Anschrift unvollständig (BG-5).');
    if (!e.stNr && !e.ustId) {
      fehler.push('Steuernummer oder USt-IdNr. der eigenen Firma fehlt (BT-31 / BT-32, § 14 Abs. 4 Nr. 2 UStG).');
    }
    if (e.ustId && !USTID_FORM.test(String(e.ustId).replace(/\s+/g, ''))) {
      hinweise.push('Eigene USt-IdNr. „' + e.ustId + '" wirkt formal unstimmig.');
    }

    /* Kunde (Buyer). */
    if (!k.name)       fehler.push('Kunde: Name fehlt (BT-44).');
    if (!k.strasse || !k.plz || !k.ort) fehler.push('Kunde: Anschrift unvollständig (BG-8).');

    /* Bei Reverse-Charge / innergemeinschaftlicher Lieferung ist die USt-ID
     * des Empfängers Pflicht. */
    var bes = r.besonderheit || 'NORMAL';
    if ((bes === 'REVERSE_CHARGE_13b' || bes === 'INNERGEM_LIEFERUNG' ||
         bes === 'INNERGEM_LEISTUNG') && !k.ustId) {
      fehler.push('USt-IdNr. des Empfängers fehlt — bei ' + bes + ' Pflicht (BT-48).');
    }
    if (k.ustId && !USTID_FORM.test(String(k.ustId).replace(/\s+/g, ''))) {
      hinweise.push('Kunde-USt-IdNr. „' + k.ustId + '" wirkt formal unstimmig.');
    }

    /* Positionen detailliert. */
    (r.positionen || []).forEach(function (p, i) {
      var prefix = 'Position ' + (i + 1) + ': ';
      if (!p.bezeichnung) fehler.push(prefix + 'Bezeichnung fehlt (BT-153).');
      if (!num(p.menge))  fehler.push(prefix + 'Menge fehlt oder 0 (BT-129).');
      if (num(p.einzelpreis) < 0) fehler.push(prefix + 'Einzelpreis ist negativ (BT-146).');
      if (bes === 'NORMAL' && p.ustSatz == null) {
        fehler.push(prefix + 'Steuersatz fehlt (BT-152).');
      }
    });

    /* Plausi der Summen. */
    var s = summen(r);
    if (!s.netto && s.netto !== 0) fehler.push('Nettosumme nicht berechenbar (BG-22).');

    return { ok: !fehler.length, fehler: fehler, hinweise: hinweise, summen: s };
  }

  /* ---- Renderer -------------------------------------------------------- */

  function renderAddress(p) {
    var a = '';
    a += tag('cbc:StreetName',         esc(p.strasse || ''));
    a += tag('cbc:CityName',           esc(p.ort || ''));
    a += tag('cbc:PostalZone',         esc(p.plz || ''));
    a += tag('cac:Country',            tag('cbc:IdentificationCode', esc(p.land || 'DE')));
    return tag('cac:PostalAddress', a);
  }

  function renderSeller(e) {
    var p = '';
    /* PartyName ist optional, hilft aber bei der Lesbarkeit. */
    p += tag('cac:PartyName', tag('cbc:Name', esc(e.name || '')));
    p += renderAddress(e);
    /* PartyTaxScheme: USt-IdNr. */
    if (e.ustId) {
      p += tag('cac:PartyTaxScheme',
        tag('cbc:CompanyID', esc(String(e.ustId).replace(/\s+/g, ''))) +
        tag('cac:TaxScheme', tag('cbc:ID', 'VAT')));
    }
    /* PartyLegalEntity: rechtliche Firmenbezeichnung + ggf. HR-Nr. */
    var legal = tag('cbc:RegistrationName', esc(e.name || ''));
    if (e.hrNummer) legal += tag('cbc:CompanyID', esc(e.hrNummer));
    p += tag('cac:PartyLegalEntity', legal);
    /* Kontakt-Block. */
    var c = '';
    if (e.ansprechpartner) c += tag('cbc:Name', esc(e.ansprechpartner));
    if (e.telefon)         c += tag('cbc:Telephone', esc(e.telefon));
    if (e.email)           c += tag('cbc:ElectronicMail', esc(e.email));
    if (c) p += tag('cac:Contact', c);
    return tag('cac:Party', p);
  }

  function renderBuyer(k) {
    var p = '';
    p += tag('cac:PartyName', tag('cbc:Name', esc(k.name || '')));
    p += renderAddress(k);
    if (k.ustId) {
      p += tag('cac:PartyTaxScheme',
        tag('cbc:CompanyID', esc(String(k.ustId).replace(/\s+/g, ''))) +
        tag('cac:TaxScheme', tag('cbc:ID', 'VAT')));
    }
    p += tag('cac:PartyLegalEntity', tag('cbc:RegistrationName', esc(k.name || '')));
    if (k.email) {
      p += tag('cac:Contact', tag('cbc:ElectronicMail', esc(k.email)));
    }
    return tag('cac:Party', p);
  }

  function renderInvoicePeriod(r) {
    if (!r.leistungszeitraumVon || !r.leistungszeitraumBis) {
      if (r.leistungsdatum) {
        return tag('cac:InvoicePeriod',
          tag('cbc:StartDate', esc(r.leistungsdatum)) +
          tag('cbc:EndDate',   esc(r.leistungsdatum)));
      }
      return '';
    }
    return tag('cac:InvoicePeriod',
      tag('cbc:StartDate', esc(r.leistungszeitraumVon)) +
      tag('cbc:EndDate',   esc(r.leistungszeitraumBis)));
  }

  function renderTaxTotal(rechnung) {
    var s = summen(rechnung);
    var sub = '';
    Object.keys(s.agg.gruppen).forEach(function (k) {
      var g = s.agg.gruppen[k];
      sub += tag('cac:TaxSubtotal',
        tag('cbc:TaxableAmount', f2(g.netto), { currencyID: CURRENCY }) +
        tag('cbc:TaxAmount',     f2(g.ust),   { currencyID: CURRENCY }) +
        tag('cac:TaxCategory',
          tag('cbc:ID', s.agg.logik.code) +
          tag('cbc:Percent', f2(g.satz)) +
          (s.agg.logik.hinweis ? tag('cbc:TaxExemptionReason', esc(s.agg.logik.hinweis)) : '') +
          tag('cac:TaxScheme', tag('cbc:ID', 'VAT'))));
    });
    return tag('cac:TaxTotal',
      tag('cbc:TaxAmount', f2(s.ust), { currencyID: CURRENCY }) + sub);
  }

  function renderMonetaryTotal(rechnung) {
    var s = summen(rechnung);
    var body = '';
    body += tag('cbc:LineExtensionAmount', f2(s.netto), { currencyID: CURRENCY });
    body += tag('cbc:TaxExclusiveAmount',  f2(s.netto), { currencyID: CURRENCY });
    body += tag('cbc:TaxInclusiveAmount',  f2(s.brutto), { currencyID: CURRENCY });
    body += tag('cbc:PayableAmount',       f2(s.brutto), { currencyID: CURRENCY });
    return tag('cac:LegalMonetaryTotal', body);
  }

  function renderInvoiceLines(rechnung) {
    var logik = STEUERLOGIK[rechnung.besonderheit] || STEUERLOGIK.NORMAL;
    var standard = logik.code === 'S';
    return rechnung.positionen.map(function (p, i) {
      var menge = num(p.menge);
      var preis = num(p.einzelpreis);
      var nettoP = Math.round((menge * preis + Number.EPSILON) * 100) / 100;
      var satz = standard ? num(p.ustSatz) : 0;
      var einheit = String(p.einheit || 'C62');
      var body = '';
      body += tag('cbc:ID', String(i + 1));
      body += tag('cbc:InvoicedQuantity', f4(menge), { unitCode: esc(einheit) });
      body += tag('cbc:LineExtensionAmount', f2(nettoP), { currencyID: CURRENCY });
      /* Item */
      var item = '';
      if (p.beschreibung) item += tag('cbc:Description', esc(p.beschreibung));
      item += tag('cbc:Name', esc(p.bezeichnung || ''));
      item += tag('cac:ClassifiedTaxCategory',
        tag('cbc:ID', logik.code) +
        tag('cbc:Percent', f2(satz)) +
        tag('cac:TaxScheme', tag('cbc:ID', 'VAT')));
      body += tag('cac:Item', item);
      /* Price */
      body += tag('cac:Price',
        tag('cbc:PriceAmount', f4(preis), { currencyID: CURRENCY }));
      return tag('cac:InvoiceLine', body);
    }).join('');
  }

  function renderPayment(rechnung, eigene) {
    var b = eigene.bank || {};
    if (!b.iban) return '';
    var fa = tag('cbc:ID', esc(b.iban.replace(/\s+/g, '')));
    if (b.bic) fa += tag('cac:FinancialInstitutionBranch',
      tag('cbc:ID', esc(b.bic)));
    /* PaymentMeansCode 58 = SEPA credit transfer. */
    return tag('cac:PaymentMeans',
      tag('cbc:PaymentMeansCode', '58') +
      tag('cac:PayeeFinancialAccount', fa));
  }

  function render(rechnung, eigene) {
    if (!rechnung) throw new Error('Rechnung fehlt.');
    if (!eigene)   throw new Error('Eigene Angaben fehlen.');
    var k = rechnung.kundeSnapshot || {};
    var s = summen(rechnung);
    var typeCode = rechnung.art === 'GUTSCHRIFT' ? CREDIT_TYPE : INVOICE_TYPE;
    var head = '<?xml version="1.0" encoding="UTF-8"?>\n';
    head += '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
            ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
            ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">';
    var body = '';
    body += tag('cbc:CustomizationID', esc(CUSTOMIZATION_ID));
    body += tag('cbc:ProfileID',       esc(PROFILE_ID));
    body += tag('cbc:ID',              esc(rechnung.nummer || ''));
    body += tag('cbc:IssueDate',       esc(rechnung.datum || ''));
    if (rechnung.faelligkeit) body += tag('cbc:DueDate', esc(rechnung.faelligkeit));
    body += tag('cbc:InvoiceTypeCode', typeCode);
    /* Verwendungs-/Begründungstext: enthält den Steuerhinweis bei Sonderfällen
     * und freie Nutzer-Notiz. */
    var note = '';
    var hinweis = (STEUERLOGIK[rechnung.besonderheit] || {}).hinweis;
    if (hinweis) note += hinweis;
    if (rechnung.hinweis) note += (note ? ' ' : '') + rechnung.hinweis;
    if (note) body += tag('cbc:Note', esc(note));
    body += tag('cbc:DocumentCurrencyCode', CURRENCY);
    /* BT-10 BuyerReference / Leitweg-ID — für B2B-Inland leer zulässig, für
     * Behörden zwingend. Wir setzen das, was der Nutzer eingegeben hat, bzw.
     * den Kundennamen als Fallback (XRechnung-Schema verlangt ein
     * BuyerReference-Element, akzeptiert aber freie Strings). */
    body += tag('cbc:BuyerReference', esc(rechnung.leitwegId || k.name || ''));
    if (rechnung.bestellnr) {
      body += tag('cac:OrderReference', tag('cbc:ID', esc(rechnung.bestellnr)));
    }
    body += renderInvoicePeriod(rechnung);
    body += tag('cac:AccountingSupplierParty', renderSeller(eigene));
    body += tag('cac:AccountingCustomerParty', renderBuyer(k));
    body += renderPayment(rechnung, eigene);
    if (rechnung.zahlungsbedingungen) {
      body += tag('cac:PaymentTerms', tag('cbc:Note', esc(rechnung.zahlungsbedingungen)));
    }
    body += renderTaxTotal(rechnung);
    body += renderMonetaryTotal(rechnung);
    body += renderInvoiceLines(rechnung);
    return head + body + '</Invoice>';
  }

  return {
    render: render, pruefe: pruefe, summen: summen,
    STEUERLOGIK: STEUERLOGIK, CUSTOMIZATION_ID: CUSTOMIZATION_ID,
    PROFILE_ID: PROFILE_ID
  };
});
