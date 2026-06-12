/* ===========================================================================
 * tests/run.js  -  Test-Suite der OpenBilanz
 * ---------------------------------------------------------------------------
 * Zero-Dependency-Testlauf. Prueft Rechenkern, Kontenmapping, Taxonomie,
 * XBRL-Erzeugung und Steuerberechnung.
 *
 *   node tests/run.js          (oder: npm test)
 *
 * Die tiefe XBRL-Validierung gegen die amtliche Taxonomie erfolgt zusätzlich
 * mit Arelle - siehe lib/validate.js.
 * ========================================================================= */
'use strict';

var Positionen = require('../public/shared/positionen.js');
var Berechnung = require('../public/shared/berechnung.js');
var Taxonomie  = require('../public/shared/taxonomie.js');
var SKR04      = require('../public/shared/skr04.js');
var Abschluss  = require('../public/shared/kontenabschluss.js');
var Umbuchung  = require('../public/shared/umbuchung.js');
var Steuer     = require('../public/shared/steuer.js');
var Ustva      = require('../public/shared/ustva.js');
var Mt940      = require('../public/shared/mt940.js');
var Datev      = require('../public/shared/datev.js');
var JournalExport = require('../public/shared/journalexport.js');
var Gdpdu      = require('../public/shared/gdpdu.js');
var Pruefkette = require('../public/shared/pruefkette.js');
var XBRL       = require('../public/shared/xbrl.js');
var Importe    = require('../public/shared/importe.js');
var XRechnungUBL = require('../public/shared/xrechnung-ubl.js');
var XRechnungCII = require('../public/shared/xrechnung-cii.js');
var Ausgangsrechnung = require('../public/shared/ausgangsrechnung.js');
var UstId = require('../public/shared/ustid.js');
var Fx    = require('../public/shared/fx.js');
var Palette = require('../public/shared/palette.js');
var Vorlagen = require('../public/shared/vorlagen.js');
var Autocomplete = require('../public/shared/autocomplete.js');
var BuchungsPruefung = require('../public/shared/buchungspruefung.js');
var Fristen = require('../public/shared/fristen.js');
var StbPaket = require('../public/shared/stbpaket.js');
var Belege = require('../public/shared/belege.js');
var Closing = require('../public/shared/closing.js');
var HealthCheck = require('../public/shared/healthcheck.js');
var Belegnummern = require('../public/shared/belegnummern.js');
var MandantenMigration = require('../public/shared/mandanten-migration.js');
var ImportProtokoll = require('../public/shared/import-protokoll.js');
var Store = require('../lib/store.js');
var UnterschriftPdf = require('../public/shared/unterschrift-pdf.js');
var OBZ = require('../public/shared/obz.js');

var tests = [], pass = 0, fail = 0;
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function eq(a, b, msg) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 0.005) throw new Error((msg || '') + ' erwartet ' + b + ', war ' + a);
  } else if (a !== b) throw new Error((msg || '') + ' erwartet ' + b + ', war ' + a);
}
function ok(c, msg) { if (!c) throw new Error(msg || 'Bedingung nicht erfuellt'); }

/* ---- Test-Umgebung: Node-Polyfills für Browser-APIs (NUR Tests) -------
 * obz.js nutzt Web Crypto + btoa/atob; importe.js parseCamt/parseIbkrFlex nutzen
 * DOMParser. In neueren Node-Versionen sind Crypto/btoa bereits global; DOMParser
 * fehlt immer. Diese Shims existieren ausschliesslich für die Test-Suite und
 * berühren den Auslieferungs-Code nicht. */
if (typeof global.crypto === 'undefined' || !global.crypto.subtle) {
  try { global.crypto = require('crypto').webcrypto; } catch (e) {}
}
if (typeof global.btoa === 'undefined') {
  global.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };
}
if (typeof global.atob === 'undefined') {
  global.atob = function (b) { return Buffer.from(b, 'base64').toString('binary'); };
}
if (typeof global.DOMParser === 'undefined') {
  /* Minimaler XML-Parser, NUR für die Tests von parseCamt/parseIbkrFlex. Deckt
   * wohlgeformtes XML (Elemente, Text, Attribute, Namespace-Präfixe, self-closing)
   * ab - genug für die getElementsByTagName('*')/localName/textContent/getAttribute-
   * Nutzung der Importe. Kein vollwertiger Parser (keine CDATA, kein '>' in Attr-Werten). */
  global.DOMParser = function () {};
  global.DOMParser.prototype.parseFromString = function (xml) {
    function unesc(s) {
      return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    }
    xml = String(xml).replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    var doc = { localName: '#document', nodes: [] }, stack = [doc], i = 0, n = xml.length;
    while (i < n) {
      if (xml.charAt(i) === '<') {
        var gt = xml.indexOf('>', i);
        if (gt < 0) throw new Error('XML');
        var tag = xml.slice(i + 1, gt); i = gt + 1;
        if (tag.charAt(0) === '/') { stack.pop(); if (!stack.length) throw new Error('XML'); continue; }
        var self = tag.slice(-1) === '/'; if (self) tag = tag.slice(0, -1);
        var sp = tag.search(/\s/);
        var name = sp < 0 ? tag : tag.slice(0, sp);
        var attrsStr = sp < 0 ? '' : tag.slice(sp);
        var local = name.indexOf(':') >= 0 ? name.split(':').pop() : name;
        var attrs = {}, aRe = /([\w.\-:]+)\s*=\s*"([^"]*)"/g, am;
        while ((am = aRe.exec(attrsStr))) {
          var k = am[1], kl = k.indexOf(':') >= 0 ? k.split(':').pop() : k;
          attrs[k] = unesc(am[2]); attrs[kl] = unesc(am[2]);
        }
        var el = { localName: local, attrs: attrs, nodes: [] };
        stack[stack.length - 1].nodes.push({ el: el });
        if (!self) stack.push(el);
      } else {
        var lt = xml.indexOf('<', i); if (lt < 0) lt = n;
        var t = xml.slice(i, lt); i = lt;
        if (t) stack[stack.length - 1].nodes.push({ text: unesc(t) });
      }
    }
    if (stack.length !== 1) throw new Error('XML unbalanced');
    function textContent(node) {
      var s = ''; (node.nodes || []).forEach(function (c) { s += c.el ? textContent(c.el) : c.text; });
      return s;
    }
    function descend(node, out) {
      (node.nodes || []).forEach(function (c) { if (c.el) { out.push(c.el); descend(c.el, out); } });
      return out;
    }
    descend(doc, []).forEach(function (node) {
      node.textContent = textContent(node);
      node.getAttribute = function (k) { return node.attrs && node.attrs[k] != null ? node.attrs[k] : null; };
      node.getElementsByTagName = function (nm) {
        var all = descend(node, []);
        return nm === '*' ? all : all.filter(function (e) { return e.localName === nm; });
      };
    });
    doc.getElementsByTagName = function (nm) {
      if (nm === 'parsererror') return [];
      var all = descend(doc, []);
      return nm === '*' ? all : all.filter(function (e) { return e.localName === nm; });
    };
    return doc;
  };
}

/* ---- Rechenkern: Bilanz / § 272 HGB ---------------------------------- */
test('Eröffnungsbilanz Teileinzahlung ist ausgeglichen', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 12500,
    eingefordertOffen: 0 }, werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} } };
  var r = Berechnung.berechne(eb).bilanz;
  ok(r.ausgeglichen, 'Bilanz nicht ausgeglichen');
  eq(r.summeAktiva, 12500, 'Summe Aktiva');
  eq(r.passiva['P.A.I'], 12500, 'Eingefordertes Kapital (P.A.I)');
  eq(r.kapital.nichtEingefordert, 12500, 'nicht eingeforderte Einlagen');
});
test('§ 272: eingefordertes, nicht eingezahltes Kapital in B.II', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 12500,
    eingefordertOffen: 5000 }, werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} } };
  var r = Berechnung.berechne(eb).bilanz;
  ok(r.ausgeglichen, 'Bilanz nicht ausgeglichen');
  eq(r.aktiva['B.II'], 5000, 'B.II enthaelt eingefordertes Kapital');
  eq(r.passiva['P.A.I'], 17500, 'Eingefordertes Kapital');
  eq(r.summeAktiva, 17500, 'Summe Aktiva');
});
test('§ 268 Abs. 3: nicht durch EK gedeckter Fehlbetrag (konsistente Bücher -> ausgeglichen)', function () {
  // Stammkapital 25.000 aufgezehrt durch Verlust 85.000 -> EK = -60.000.
  // Konsistente Bücher: Aktiva 5.000 = EK -60.000 + Verbindlichkeiten 65.000.
  // § 268 Abs. 3: der Fehlbetrag (60.000) erscheint als Aktivposten F, die Bilanz
  // bleibt ausgeglichen (Bilanzsumme beidseitig 65.000).
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 5000 }, passiva: { 'P.C.4': 65000 },
      guv: { 'gkv.8': 85000 } } };
  var r = Berechnung.berechne(ja).bilanz;
  eq(r.fehlbetrag, 60000, 'Fehlbetrag');
  eq(r.summeAktiva, 65000, 'Summe Aktiva (inkl. Fehlbetrag)');
  eq(r.summePassiva, 65000, 'Summe Passiva (negatives EK auf Aktivseite reklassifiziert)');
  ok(r.ausgeglichen, 'Bilanz trotz Fehlbetrag ausgeglichen');
});
test('§ 268 Abs. 3: inkonsistente überschuldete Bücher werden korrekt als unausgeglichen erkannt', function () {
  // Gleiches EK -60.000, aber Verbindlichkeiten 125.000 statt 65.000 -> Bücher sind
  // real um 60.000 unausgeglichen (Aktiva 5.000 != EK -60.000 + Verb 125.000 = 65.000).
  // Regression-Schutz: die Doppelzählung des negativen EK (§ 268 Abs. 3) darf diese
  // Inkonsistenz NICHT mehr zufällig zu "ausgeglichen" kaschieren.
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 5000 }, passiva: { 'P.C.4': 125000 },
      guv: { 'gkv.8': 85000 } } };
  var r = Berechnung.berechne(ja).bilanz;
  ok(!r.ausgeglichen, 'inkonsistente Bücher müssen als unausgeglichen gelten');
  eq(r.differenz, -60000, 'Differenz = -60.000 (fehlende Aktiva)');
});

/* ---- Geführte Umbuchung zwischen eigenen Konten ---------------------- */
test('Umbuchung direkt: Soll = Ziel, Haben = Quelle (Aktiv an Aktiv)', function () {
  var r = Umbuchung.buchungen({ von: '1800', nach: '1810', betrag: 500, datum: '2026-03-01', stamp: 7 });
  ok(r.ok, 'ok'); eq(r.buchungen.length, 1, 'eine Buchung');
  eq(r.buchungen[0].soll, '1810', 'Soll = Ziel'); eq(r.buchungen[0].haben, '1800', 'Haben = Quelle');
  eq(r.buchungen[0].betrag, 500, 'Betrag');
  ok(r.buchungen[0].text.indexOf('1800') >= 0, 'Default-Text nennt Quelle');
});
test('Umbuchung über Geldtransit 1460: zwei Sätze, 1460 nettet auf 0', function () {
  var r = Umbuchung.buchungen({ von: '1800', nach: '1600', betrag: 200, ueberTransit: true, stamp: 3 });
  ok(r.ok, 'ok'); eq(r.buchungen.length, 2, 'zwei Buchungen');
  eq(r.buchungen[0].soll, '1460', '1: Soll 1460'); eq(r.buchungen[0].haben, '1800', '1: Haben Quelle');
  eq(r.buchungen[1].soll, '1600', '2: Soll Ziel'); eq(r.buchungen[1].haben, '1460', '2: Haben 1460');
  // 1460-Saldo: einmal Soll (Eingang) + einmal Haben (Ausgang) = 0
  var transitSaldo = r.buchungen.reduce(function (s, b) {
    return s + (b.soll === '1460' ? b.betrag : 0) - (b.haben === '1460' ? b.betrag : 0);
  }, 0);
  eq(transitSaldo, 0, '1460 nettet auf 0');
});
test('Umbuchung: eigener Transitkonto-Override', function () {
  var r = Umbuchung.buchungen({ von: '1800', nach: '1810', betrag: 50, ueberTransit: true, transitKonto: '1461', stamp: 1 });
  eq(r.buchungen[0].soll, '1461', 'Override-Transitkonto');
});
test('Umbuchung: identische Konten / Betrag 0 / fehlende Konten werden abgelehnt', function () {
  ok(!Umbuchung.buchungen({ von: '1800', nach: '1800', betrag: 100 }).ok, 'identisch abgelehnt');
  ok(!Umbuchung.buchungen({ von: '1800', nach: '1810', betrag: 0 }).ok, 'Betrag 0 abgelehnt');
  ok(!Umbuchung.buchungen({ von: '', nach: '1810', betrag: 100 }).ok, 'fehlende Quelle abgelehnt');
  ok(!Umbuchung.buchungen({ von: '1800', nach: '1810', betrag: -5 }).ok, 'negativer Betrag abgelehnt');
});

/* ---- OBZ-Sicherung: Pack/Entpack-Roundtrip (Daten + Krypto) ---------- */
test('OBZ: unverschlüsselter Roundtrip erhält Unternehmen + Abschlüsse', function () {
  var daten = { unternehmen: { name: 'Test GmbH' }, abschluesse: [{ id: 'A-1', stichtag: '2025-12-31' }] };
  return OBZ.packen(daten).then(function (bytes) {
    ok(bytes && bytes.length > 0, 'Bytes erzeugt');
    return OBZ.entpacken(bytes, function () { return ''; });
  }).then(function (snap) {
    eq(snap.unternehmen.name, 'Test GmbH', 'Unternehmen erhalten');
    eq(snap.abschluesse.length, 1, 'Abschluss erhalten');
    eq(snap.abschluesse[0].id, 'A-1', 'Abschluss-ID erhalten');
  });
});
test('OBZ: verschlüsselter Roundtrip (AES-GCM/PBKDF2), Klartext nicht lesbar', function () {
  var daten = { unternehmen: { name: 'Geheim GmbH' }, abschluesse: [] };
  return OBZ.packen(daten, 'pw-123').then(function (bytes) {
    var txt = Buffer.from(bytes).toString('utf8');
    ok(txt.indexOf('Geheim GmbH') < 0, 'Klartext nicht im verschlüsselten Umschlag');
    ok(/"verschluesselt":\s*true/.test(txt), 'als verschlüsselt markiert');
    return OBZ.entpacken(bytes, function () { return 'pw-123'; });
  }).then(function (snap) {
    eq(snap.unternehmen.name, 'Geheim GmbH', 'nach Entschlüsselung erhalten');
  });
});
test('OBZ: falsches Passwort wird abgewiesen (GCM-Integritätsprüfung)', function () {
  return OBZ.packen({ unternehmen: { name: 'X' }, abschluesse: [] }, 'richtig').then(function (bytes) {
    return OBZ.entpacken(bytes, function () { return 'falsch'; }).then(function () {
      throw new Error('hätte fehlschlagen müssen');
    }, function (e) { ok(/Passwort/i.test(e.message), 'sprechender Passwort-Fehler'); });
  });
});
test('OBZ: ungültige Datei wird abgewiesen', function () {
  return OBZ.entpacken(new TextEncoder().encode('kein obz'), function () { return ''; }).then(function () {
    throw new Error('hätte fehlschlagen müssen');
  }, function (e) { ok(/obz|Sicherung|Format/i.test(e.message), 'sprechender Format-Fehler'); });
});

/* ---- Bankimport-Parser: CAMT.053 + IBKR-Flex (DOMParser-basiert) ----- */
var CAMT_FIXTURE =
  '<?xml version="1.0"?>\n' +
  '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>' +
  '<Ntry><Amt Ccy="EUR">1500,00</Amt><CdtDbtInd>CRDT</CdtDbtInd>' +
  '<BookgDt><Dt>2025-03-01</Dt></BookgDt><NtryDtls><TxDtls>' +
  '<RltdPties><Dbtr><Nm>Kunde Müller</Nm></Dbtr></RltdPties>' +
  '<RmtInf><Ustrd>Rechnung 2025-007</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>' +
  '<Ntry><Amt Ccy="EUR">89,90</Amt><CdtDbtInd>DBIT</CdtDbtInd>' +
  '<BookgDt><Dt>2025-03-02</Dt></BookgDt><NtryDtls><TxDtls>' +
  '<RmtInf><Ustrd>Hosting Hetzner</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>' +
  '</Stmt></BkToCstmrStmt></Document>';
test('Importe.parseCamt: CAMT.053 Ein-/Ausgang, Betrag, Datum, Partner, Zweck', function () {
  var r = Importe.parseCamt(CAMT_FIXTURE);
  ok(!r.fehler, 'kein Fehler');
  eq(r.tx.length, 2, 'zwei Umsätze');
  eq(r.tx[0].eingang, true, 'CRDT -> Eingang');
  eq(r.tx[0].betrag, 1500, 'Betrag 1500 (Komma-Dezimal)');
  eq(r.tx[0].datum, '2025-03-01', 'Buchungsdatum aus BookgDt');
  ok(r.tx[0].partner.indexOf('Müller') >= 0, 'Partner aus Nm');
  ok(r.tx[0].zweck.indexOf('2025-007') >= 0, 'Zweck aus Ustrd');
  eq(r.tx[1].eingang, false, 'DBIT -> Ausgang');
  eq(r.tx[1].betrag, 89.90, 'Betrag 89,90');
});
test('Importe.parseCamt: Nicht-XML und fehlende Ntry werden abgewiesen', function () {
  ok(Importe.parseCamt('kein xml hier').fehler, 'kein XML/keine Ntry -> Fehler');
  ok(Importe.parseCamt('<Document></Document>').fehler, 'keine Ntry -> Fehler');
});
var IBKR_FIXTURE =
  '<FlexQueryResponse><FlexStatements><FlexStatement>' +
  '<Trades><Trade buySell="BUY" quantity="10" symbol="AAPL" tradeDate="20250115" netCash="-1500.50"/></Trades>' +
  '<CashTransactions>' +
  '<CashTransaction type="Dividends" amount="42.00" symbol="AAPL" dateTime="20250120" description="AAPL Dividend"/>' +
  '<CashTransaction type="Withholding Tax" amount="-6.30" symbol="AAPL" dateTime="20250120" description="Tax"/>' +
  '</CashTransactions></FlexStatement></FlexStatements></FlexQueryResponse>';
test('Importe.parseIbkrFlex: Trade + Dividende + Quellensteuer korrekt gemappt', function () {
  var r = Importe.parseIbkrFlex(IBKR_FIXTURE);
  ok(!r.fehler, 'kein Fehler');
  eq(r.tx.length, 3, 'Trade + 2 Cash-Transaktionen');
  eq(r.tx[0].eingang, false, 'Kauf (netCash<0) -> Ausgang');
  eq(r.tx[0].betrag, 1500.50, 'Trade-Betrag absolut');
  eq(r.tx[0].kontoHint, '1510', 'Wertpapier-Kontohint');
  var div = r.tx.filter(function (t) { return t.kontoHint === '7010'; })[0];
  ok(div && div.eingang, 'Dividende -> 7010, Eingang');
  var tax = r.tx.filter(function (t) { return t.kontoHint === '7600'; })[0];
  ok(tax && !tax.eingang, 'Quellensteuer -> 7600, Ausgang');
});
test('Importe.parseIbkrFlex: leere Datei wird abgewiesen', function () {
  ok(Importe.parseIbkrFlex('<FlexQueryResponse></FlexQueryResponse>').fehler, 'keine Trades -> Fehler');
});

/* ---- Bank-Gegenkonto-Heuristik (bankKontoVorschlag) ------------------ */
test('Importe.bankKontoVorschlag: eingebaute Regeln treffen', function () {
  eq(Importe.bankKontoVorschlag('Miete Büro März', false), '6310', 'Miete -> 6310');
  eq(Importe.bankKontoVorschlag('Telekom Rechnung', false), '6805', 'Telekom -> 6805');
  eq(Importe.bankKontoVorschlag('Hetzner Server', false), '6300', 'Hosting -> 6300');
  eq(Importe.bankKontoVorschlag('Gehalt Mitarbeiter', false), '6020', 'Gehalt -> 6020');
  eq(Importe.bankKontoVorschlag('Finanzamt Umsatzsteuer', false), '3700', 'Finanzamt -> 3700');
  eq(Importe.bankKontoVorschlag('Gewerbesteuer Stadt', false), '7610', 'GewSt -> 7610');
  eq(Importe.bankKontoVorschlag('Zinsen', true), '7100', 'Zins-Eingang -> 7100');
  eq(Importe.bankKontoVorschlag('Zinsen', false), '7300', 'Zins-Ausgang -> 7300');
});
test('Importe.bankKontoVorschlag: Nutzerregel hat Vorrang, sonst Default', function () {
  eq(Importe.bankKontoVorschlag('XY Spezial', false, [{ muster: 'spezial', konto: '6855' }]), '6855', 'Nutzerregel schlägt Default');
  eq(Importe.bankKontoVorschlag('Komplett unbekannt', true), '4400', 'Default Eingang -> 4400 (Erlös)');
  eq(Importe.bankKontoVorschlag('Komplett unbekannt', false), '6300', 'Default Ausgang -> 6300');
});

/* ---- Closing-Checkliste: bisher ungetestete Prüfpunkte --------------- */
test('Closing.pruefeJaReadiness: Rechnungsabgrenzung erkennt 1900/3900', function () {
  var mit = Closing.pruefeJaReadiness({ buchungen: [{ soll: '1900', haben: '1800', betrag: 100 }], werte: {} });
  var rap = mit.filter(function (x) { return /Rechnungsabgrenzung/.test(x.titel); })[0];
  ok(rap && rap.detail.indexOf('1900') >= 0, 'detail nennt vorhandenes 1900');
  var ohne = Closing.pruefeJaReadiness({ buchungen: [], werte: {} });
  var rap2 = ohne.filter(function (x) { return /Rechnungsabgrenzung/.test(x.titel); })[0];
  ok(rap2 && /abgrenzen/.test(rap2.detail), 'ohne RAP -> Erinnerungstext (§ 250 HGB)');
});
test('Closing.pruefeJaReadiness: Bilanz-ausgeglichen-Punkt nur mit werte', function () {
  var mit = Closing.pruefeJaReadiness({ buchungen: [], werte: {} });
  ok(mit.some(function (x) { return x.titel === 'Bilanz ausgeglichen'; }), 'mit werte -> Punkt vorhanden');
  var ohne = Closing.pruefeJaReadiness({ buchungen: [] });
  ok(!ohne.some(function (x) { return x.titel === 'Bilanz ausgeglichen'; }), 'ohne werte -> kein Punkt');
});
/* ---- Review-Nacharbeiten: neue Plausibilitäts-Warnungen ---------------- */
test('BuchungsPruefung: 2910 im Haben löst Hinweis aus (§ 272: Konto führt Soll-Saldo)', function () {
  var pr = BuchungsPruefung.pruefe({ datum: '2026-01-05', betrag: 1000, soll: '1800', haben: '2910' }, {});
  ok(pr.ok, 'weiche Warnung, kein harter Fehler');
  ok(pr.warnungen.some(function (w) { return w.indexOf('2910 im Haben') >= 0; }), '2910-Haben-Hinweis');
  var pr2 = BuchungsPruefung.pruefe({ datum: '2026-01-05', betrag: 1000, soll: '2910', haben: '2900' }, {});
  ok(!pr2.warnungen.some(function (w) { return w.indexOf('2910 im Haben') >= 0; }),
     '2910 im Soll (Normalfall Gründung) ohne diesen Hinweis');
});
test('Prüfung: direkt erfasster Oberposten-Wert + belegte Unterposten wird gemeldet', function () {
  // B.II direkt 5.000 erfasst UND B.II.1 mit 300 belegt -> baumSummen nimmt die
  // Kindersumme (300), die 5.000 verfallen still. Seit Review-Nacharbeit: Warnung.
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 25000,
    eingefordertOffen: 0 },
    werte: { aktiva: { 'B.II': 5000, 'B.II.1': 300, 'B.IV': 24700 }, passiva: {}, guv: {} } };
  var p = Berechnung.pruefe(eb);
  ok(p.meldungen.some(function (m) {
    return m.text.indexOf('B.II') >= 0 && m.text.indexOf('ignoriert') >= 0;
  }), 'Konflikt-Warnung für B.II');
  // Gegenprobe: ohne Doppel-Eingabe keine solche Warnung
  var eb2 = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 25000,
    eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 25000 }, passiva: {}, guv: {} } };
  ok(!Berechnung.pruefe(eb2).meldungen.some(function (m) {
    return m.text.indexOf('ignoriert') >= 0;
  }), 'keine Konflikt-Warnung ohne Doppel-Eingabe');
});

/* ---- Fristen: Aufstellungsfrist nach Größenklasse (§ 264 Abs. 1 HGB) -- */
test('Fristen: Aufstellung 6 Monate (kleine KapG) vs. 3 Monate (mittelgroße)', function () {
  function aufstellungsFrist(groessenklasse) {
    var f = Fristen.naechsteFristen({}, [{ id: 'A-1', art: 'JAHRESABSCHLUSS',
      stichtag: '2025-12-31', groessenklasse: groessenklasse }], '2026-01-15');
    return f.filter(function (x) { return x.art === 'aufstellung'; })[0];
  }
  eq(aufstellungsFrist('KLEIN').frist, '2026-06-30', 'kleine KapG: 6 Monate (S. 4)');
  eq(aufstellungsFrist('KLEINST').frist, '2026-06-30', 'Kleinst: 6 Monate');
  eq(aufstellungsFrist(undefined).frist, '2026-06-30', 'ohne Einstufung: 6 Monate (Default kleine GmbH)');
  eq(aufstellungsFrist('MITTEL').frist, '2026-03-31', 'mittelgroße KapG: 3 Monate (S. 3)');
  eq(aufstellungsFrist('GROSS').frist, '2026-03-31', 'große KapG: 3 Monate');
  ok(/S\. 3/.test(aufstellungsFrist('MITTEL').paragraph), 'Paragraph nennt Satz 3');
});

/* ---- SKR04-Konten-Glossar (eigene Erklärtexte) ----------------------- */
test('SKR04Glossar: jede Glossar-Nummer existiert im Kontenrahmen', function () {
  var G = require('../public/shared/skr04-glossar.js');
  var nrs = G.nummern();
  ok(nrs.length >= 40, 'Etappe 1: mindestens 40 Konten erklärt (sind ' + nrs.length + ')');
  var fehlend = nrs.filter(function (n) { return !SKR04.kontoFinden(n); });
  eq(fehlend.length, 0, 'verwaiste Glossar-Nummern: ' + fehlend.join(','));
});
test('SKR04Glossar: Texte substanziell, API liefert null für Unbekanntes', function () {
  var G = require('../public/shared/skr04-glossar.js');
  var zuKurz = G.nummern().filter(function (n) { return (G.erklaerung(n) || '').length < 40; });
  eq(zuKurz.length, 0, 'zu kurze Texte: ' + zuKurz.join(','));
  ok(G.hatErklaerung('1460'), 'Geldtransit hat Erklärung');
  ok(/§ 272/.test(G.erklaerung('2910')), '2910 nennt § 272 (ausstehende Einlagen)');
  ok(/§ 146/.test(G.erklaerung('1600')), 'Kasse nennt § 146 AO (Kassensturz)');
  eq(G.erklaerung('9999'), null, 'unbekanntes Konto -> null');
  eq(G.hatErklaerung('9999'), false, 'hatErklaerung false');
});
test('SKR04Glossar: kein Konto doppelt, Kernkonten der GmbH abgedeckt', function () {
  var G = require('../public/shared/skr04-glossar.js');
  var kern = ['1800', '1600', '1460', '2900', '2910', '1406', '3806', '4400', '6300', '7600', '7610', '9000'];
  var fehlt = kern.filter(function (n) { return !G.hatErklaerung(n); });
  eq(fehlt.length, 0, 'Kernkonten ohne Erklärung: ' + fehlt.join(','));
});

test('Closing.hatKonto/summeKonto: Saldo korrekt, Storno ignoriert', function () {
  var bu = [{ soll: '1800', haben: '4400', betrag: 100 },
            { soll: '6300', haben: '1800', betrag: 30, storniert: true }];
  ok(Closing.hatKonto(bu, '1800'), 'hatKonto findet 1800');
  ok(!Closing.hatKonto(bu, '6300'), 'storniertes 6300 zählt nicht');
  eq(Closing.summeKonto(bu, '1800').saldo, 100, 'Saldo 1800 (Storno ignoriert)');
});

/* ---- Rechenkern: GuV -------------------------------------------------- */
test('GuV Gesamtkostenverfahren: Jahresüberschuss', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    werte: { aktiva: {}, passiva: {}, guv: { 'gkv.1': 100000, 'gkv.6': 60000,
      'gkv.8': 15000, 'gkv.14': 5000 } } };
  var g = Berechnung.rechneGuv(ja);
  eq(g.werte['gkv.15'], 20000, 'Ergebnis nach Steuern');
  eq(g.jahresergebnis, 20000, 'Jahresüberschuss');
});
test('GuV Kleinst-verkürzt (§ 275 Abs. 5)', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'KLEINST',
    werte: { aktiva: {}, passiva: {}, guv: { 'kst.1': 50000, 'kst.4': 30000, 'kst.7': 3000 } } };
  var g = Berechnung.rechneGuv(ja);
  eq(g.jahresergebnis, 17000, 'Jahresüberschuss Kleinst');
});
test('Jahresüberschuss fliesst in P.A.V', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 45000 }, passiva: {}, guv: { 'gkv.1': 50000, 'gkv.8': 30000 } } };
  var r = Berechnung.berechne(ja);
  eq(r.bilanz.passiva['P.A.V'], 20000, 'Jahresüberschuss in P.A.V');
});

/* ---- Größenklassen § 267/267a -------------------------------------- */
test('Größenklasse: Kleinst (neue Schwellen ab 2024)', function () {
  var k = Berechnung.bestimmeGroessenklasse(
    { bilanzsumme: 400000, umsatz: 800000, arbeitnehmer: 8 }, '2026-01-01', {});
  eq(k.klasse, 'KLEINST', 'Klasse'); eq(k.schwellensatz, 'neu', 'Schwellensatz');
});
test('Größenklasse: klein bei Ueberschreiten von 2 Kleinst-Schwellen', function () {
  // Bilanzsumme und Umsatz über Kleinst-Grenze -> 2-von-3-Regel -> klein
  var k = Berechnung.bestimmeGroessenklasse(
    { bilanzsumme: 2000000, umsatz: 2000000, arbeitnehmer: 8 }, '2026-01-01', {});
  eq(k.klasse, 'KLEIN', 'zwei Kleinst-Schwellen ueberschritten -> klein');
});
test('Größenklasse: alte Schwellen vor 2024', function () {
  var k = Berechnung.bestimmeGroessenklasse(
    { bilanzsumme: 400000, umsatz: 800000, arbeitnehmer: 8 }, '2022-01-01', {});
  eq(k.schwellensatz, 'alt', 'vor 2024 -> alte Schwellen');
});

/* ---- Pruefungen ------------------------------------------------------- */
test('Prüfung meldet unausgeglichene Bilanz', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', kapital: { gezeichnet: 25000, eingezahlt: 25000,
    eingefordertOffen: 0 }, werte: { aktiva: { 'B.IV': 99999 }, passiva: {}, guv: {} } };
  var p = Berechnung.pruefe(eb);
  ok(p.meldungen.some(function (m) { return m.stufe === 'fehler'; }), 'Fehler erwartet');
});
test('Prüfung: Eigenkapitalquote unter 10 % wird gemeldet', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 500000 }, passiva: { 'P.C.4': 475000 }, guv: {} } };
  var p = Berechnung.pruefe(ja);
  ok(p.meldungen.some(function (m) { return m.text.indexOf('Eigenkapitalquote') >= 0; }),
     'EK-Quoten-Warnung erwartet');
});
test('Prüfung: Gewinn ohne Steuerrückstellung wird gemeldet', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 85000 }, passiva: {}, guv: { 'gkv.1': 100000, 'gkv.8': 40000 } } };
  var p = Berechnung.pruefe(ja);
  ok(p.meldungen.some(function (m) { return m.text.indexOf('Steuerrückstellung') >= 0; }),
     'Hinweis auf fehlende Steuerrückstellung erwartet');
});
test('Prüfung: gebuchte Steuerrückstellung unterdrückt den Steuer-Hinweis', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 92000 }, passiva: { 'P.B.2': 7000 },
      guv: { 'gkv.1': 100000, 'gkv.8': 40000 } } };
  var p = Berechnung.pruefe(ja);
  ok(!p.meldungen.some(function (m) { return m.text.indexOf('Steuerrückstellung') >= 0; }),
     'kein Steuer-Hinweis bei vorhandener Rückstellung');
});
test('Prüfung: Abschreibungen ohne Anlagevermögen werden gemeldet', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 74000 }, passiva: { 'P.B.2': 7000 },
      guv: { 'gkv.1': 50000, 'gkv.7': 8000 } } };
  var p = Berechnung.pruefe(ja);
  ok(p.meldungen.some(function (m) { return m.text.indexOf('Abschreibungen') >= 0 &&
     m.text.indexOf('Anlagevermögen') >= 0; }), 'Abschreibungs-Hinweis erwartet');
});
test('Prüfung: Beteiligungserträge ohne Finanzanlagen werden gemeldet', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 60000 }, passiva: { 'P.B.2': 5000 }, guv: { 'gkv.9': 30000 } } };
  var p = Berechnung.pruefe(ja);
  ok(p.meldungen.some(function (m) { return m.text.indexOf('Finanzanlagen (A.III)') >= 0; }),
     'Hinweis auf fehlende Finanzanlagen erwartet');
});
test('Prüfung: Wertpapier-UV (B.III) erinnert an Niederstwertprinzip', function () {
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.III': 50000, 'B.IV': 30000 },
      passiva: { 'P.B.2': 5000 }, guv: { 'gkv.1': 80000, 'gkv.8': 25000 } } };
  var p = Berechnung.pruefe(ja);
  ok(p.meldungen.some(function (m) { return m.stufe === 'info' &&
     m.text.indexOf('Niederstwertprinzip') >= 0; }),
     'Niederstwert-Hinweis bei Wertpapier-UV erwartet');
  // Kein Hinweis, wenn keine WP-UV-Bestände
  var leer = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 30000 }, passiva: { 'P.B.2': 5000 }, guv: {} } };
  ok(!Berechnung.pruefe(leer).meldungen.some(function (m) {
     return m.text.indexOf('Niederstwertprinzip') >= 0; }),
     'kein Niederstwert-Hinweis ohne WP-UV');
});
test('Prüfung: Vorjahresabweichung über 20 % nur mit Vorjahr', function () {
  var vorjahr = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 100000 }, passiva: { 'P.C.4': 75000 }, guv: {} } };
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 150000 }, passiva: { 'P.C.4': 125000 }, guv: {} } };
  ok(!Berechnung.pruefe(ja).meldungen.some(function (m) { return m.text.indexOf('Vorjahr') >= 0; }),
     'ohne Vorjahr kein Abweichungs-Hinweis');
  var mit = Berechnung.pruefe(ja, vorjahr);
  ok(mit.meldungen.some(function (m) { return m.stufe === 'info' &&
     m.text.indexOf('Bilanzsumme') >= 0; }), 'Abweichungs-Hinweis mit Vorjahr erwartet');
});

/* ---- SKR04-Kontenmapping (Integritaet) ------------------------------- */
test('SKR04: 6855 (Nebenkosten Geldverkehr) ist vorhanden', function () {
  var k = SKR04.kontoFinden('6855');
  ok(k, 'Konto 6855 fehlt');
  eq(k.seite, 'AUFWAND', 'seite');
  eq(k.kat, 'sonstaufwand', 'kat');
});
/* ---- T1: Vollständiger SKR04-Kontenrahmen (skr04-voll.js) ------------- */
test('SKR04-VOLL: 6420 (Beiträge) ist wähl-/buchbar + korrekt zugeordnet', function () {
  var k = SKR04.kontoFinden('6420');
  ok(k, 'Konto 6420 (Beiträge) fehlt — Christins Auslöser-Konto');
  eq(k.seite, 'AUFWAND', '6420 ist Aufwand');
  ok(SKR04.KAT_GUV[k.kat], '6420: kat muss gültig sein, war ' + k.kat);
  ok(SKR04.alleKonten().some(function (x) { return x.nr === '6420'; }), '6420 in Auswahlliste');
});
test('SKR04-VOLL: Auswahlliste deckt den vollen Kontenrahmen ab', function () {
  ok(SKR04.alleKonten().length > 800, 'alleKonten zu klein: ' + SKR04.alleKonten().length);
});
test('SKR04-VOLL: KEIN Verpuffen — jedes Konto hat eine gültige Bilanz-/GuV-Zuordnung', function () {
  var alle = Positionen.AKTIVA.concat(Positionen.PASSIVA);
  SKR04.alleKonten().forEach(function (k) {
    if (k.seite === 'EBK') return;            // reines Verrechnungskonto, by design ohne pos
    if (k.seite === 'AKTIV' || k.seite === 'PASSIV') {
      ok(k.pos, 'Konto ' + k.nr + ' ohne pos (würde verpuffen)');
      ok(Positionen.finde(alle, k.pos), 'Konto ' + k.nr + ': ungültige Position ' + k.pos);
    } else if (k.seite === 'ERTRAG' || k.seite === 'AUFWAND') {
      ok(SKR04.KAT_GUV[k.kat], 'Konto ' + k.nr + ': ungültige Kategorie ' + k.kat + ' (würde verpuffen)');
    } else {
      ok(false, 'Konto ' + k.nr + ': unbekannte seite ' + k.seite);
    }
  });
});
test('SKR04-VOLL: kuratierte Sonderfälle gewinnen gegen die generierte Liste', function () {
  eq(SKR04.kontoFinden('1460').pos, 'B.IV', '1460 Geldtransit muss B.IV bleiben (nicht ERPNext-B.II)');
  eq(SKR04.kontoFinden('3070').pos, 'P.B.3', '3070 sonstige Rückstellungen muss P.B.3 bleiben');
  eq(SKR04.kontoFinden('1180').pos, 'B.I', '1180 Anz. auf Vorräte muss B.I bleiben (nicht ERPNext-A.I)');
});
test('SKR04-VOLL: Kontonummern in der gesamten Auswahlliste eindeutig', function () {
  var seen = {};
  SKR04.alleKonten().forEach(function (k) {
    ok(!seen[k.nr], 'Doppelte Kontonummer ' + k.nr + ' in alleKonten()');
    seen[k.nr] = true;
  });
});
test('SKR04-VOLL: Stichprobe weiterer Standard-Konten buchbar + plausibel', function () {
  var p = SKR04.kontoFinden('6310');   // Miete (sonst. Aufw.)
  ok(p && p.seite === 'AUFWAND', '6310 fehlt/falsch');
  var f = SKR04.kontoFinden('1200');   // Forderungen aLuL (kuratiert)
  ok(f && f.pos === 'B.II', '1200 falsch');
});
/* ---- Kontenabschluss: Salden -> Werte (vorzeichenrichtig, Kontra-Konten) -- */
test('Abschluss: normales Ertrags-/Aufwandskonto landet korrekt', function () {
  var w = Abschluss.salden2werte({
    '4400': { soll: 0, haben: 1000 },   // Umsatz (Haben)
    '6420': { soll: 50, haben: 0 }      // Beiträge (Aufwand, Soll)
  }, { guvVerfahren: 'GKV' });
  eq(w.guv[SKR04.KAT_GUV.umsatz.GKV], 1000, 'Umsatz');
  eq(w.guv[SKR04.KAT_GUV.sonstaufwand.GKV], 50, 'Aufwand');
});
test('Abschluss: Kontra-Konto (gewährter Skonto) MINDERT den Umsatz, nicht addiert', function () {
  // Bug-Regression: früher Math.abs -> Skonto wurde aufaddiert (1200) -> Bilanz-Bruch.
  var w = Abschluss.salden2werte({
    '4400': { soll: 0, haben: 1000 },   // Umsatz 1000
    '4730': { soll: 200, haben: 0 }     // gewährter Skonto 200 (kat=umsatz, Soll-Saldo)
  }, { guvVerfahren: 'GKV' });
  eq(w.guv[SKR04.KAT_GUV.umsatz.GKV], 800, 'Umsatz netto nach Erlösschmälerung');
});
test('Abschluss: erhaltener Skonto mindert den Materialaufwand', function () {
  var w = Abschluss.salden2werte({
    '5200': { soll: 1000, haben: 0 },   // Wareneingang 1000 (material, Soll)
    '5730': { soll: 0, haben: 100 }     // erhaltener Skonto 100 (material, Haben-Saldo)
  }, { guvVerfahren: 'GKV' });
  eq(w.guv[SKR04.KAT_GUV.material.GKV], 900, 'Material netto nach erhaltenem Skonto');
});
test('Abschluss: Bilanz bleibt ausgeglichen trotz Kontra-Buchung', function () {
  // Bank an Umsatz 1000, gewährter Skonto 4730 an Bank 200 -> Bank 800, Ergebnis 800.
  var w = Abschluss.salden2werte({
    '1800': { soll: 1000, haben: 200 }, // Bank: +800
    '4400': { soll: 0, haben: 1000 },
    '4730': { soll: 200, haben: 0 }
  }, { guvVerfahren: 'GKV' });
  var aktiva = w.aktiva['B.IV'] || 0;
  var ergebnis = (w.guv[SKR04.KAT_GUV.umsatz.GKV] || 0);
  eq(aktiva, 800, 'Bank-Aktiva');
  eq(aktiva - ergebnis, 0, 'Aktiva = Ergebnis (ohne EK) -> ausgeglichen');
});
test('Abschluss: 2900 -> kapitalGezeichnet, EBK/P.A.I/P.A.V werden übersprungen', function () {
  var w = Abschluss.salden2werte({
    '2900': { soll: 0, haben: 25000 },  // Stammkapital
    '9000': { soll: 0, haben: 25000 }   // EBK -> ignoriert
  }, { guvVerfahren: 'GKV' });
  eq(w.kapitalGezeichnet, 25000, 'gezeichnetes Kapital');
  ok(!w.passiva['P.A.I'], 'P.A.I wird automatisch berechnet, nicht aggregiert');
});
test('§ 272: Konto 2910 (ausstehende Einlagen, nicht eingefordert) verpufft NICHT', function () {
  // Gründungsbuchung: Bank 12500 + 2910 12500 an 2900 25000
  var w = Abschluss.salden2werte({
    '1800': { soll: 12500, haben: 0 },
    '2910': { soll: 12500, haben: 0 },   // nicht eingeforderte ausstehende Einlagen (Soll-Saldo)
    '2900': { soll: 0, haben: 25000 }
  }, { guvVerfahren: 'GKV' });
  eq(w.kapitalGezeichnet, 25000, 'gezeichnetes Kapital aus 2900');
  eq(w.kapitalNichtEingefordert, 12500, '2910-Saldo -> nicht eingefordert (nicht verpufft)');
  eq(w.aktiva['B.IV'], 12500, 'Bank-Einzahlung');
});
test('§ 272: Buchungs-Modus — gebuchtes 2910 ergibt eingefordertes Kapital + ausgeglichene Bilanz', function () {
  var a = {
    kapital: { gezeichnet: 25000, nichtEingefordert: 12500, eingezahlt: 12500 },
    werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} },
    erfassungsmodus: 'BUCHHALTUNG', guvVerfahren: 'GKV'
  };
  var r = Berechnung.berechne(a);
  eq(r.bilanz.kapital.nichtEingefordert, 12500, 'nicht eingefordert aus Buchung');
  eq(r.bilanz.kapital.eingefordertesKapital, 12500, 'eingefordertes Kapital = Nennbetrag ./. nicht eingefordert');
  eq(r.bilanz.passiva['P.A.I'], 12500, 'P.A.I = eingefordertes Kapital');
  eq(r.bilanz.summeAktiva, r.bilanz.summePassiva, 'Bilanz ausgeglichen');
});
test('§ 272: Eingabe-Modus ignoriert ein gebuchtes nichtEingefordert (kein Sticky-State)', function () {
  // Ohne erfassungsmodus BUCHHALTUNG wird nichtEingefordert aus den Eingaben abgeleitet.
  var k = Berechnung.kapitalRechnen(
    { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0, nichtEingefordert: 9999 });
  eq(k.nichtEingefordert, 0, 'voll eingezahlt -> nicht eingefordert 0, stale 9999 ignoriert');
});
test('SKR04: jedes Konto-pos ist eine gueltige HGB-Position', function () {
  var alle = Positionen.AKTIVA.concat(Positionen.PASSIVA);
  SKR04.KONTEN.forEach(function (k) {
    if (k.seite === 'AKTIV' || k.seite === 'PASSIV') {
      ok(k.pos, 'Konto ' + k.nr + ' ohne pos');
      ok(Positionen.finde(alle, k.pos), 'Konto ' + k.nr + ': unbekannte Position ' + k.pos);
    }
  });
});
test('SKR04: jede GuV-Kategorie ist in KAT_GUV definiert', function () {
  SKR04.KONTEN.forEach(function (k) {
    if (k.seite === 'ERTRAG' || k.seite === 'AUFWAND') {
      ok(SKR04.KAT_GUV[k.kat], 'Konto ' + k.nr + ': unbekannte Kategorie ' + k.kat);
    }
  });
});
test('SKR04: Kontonummern eindeutig', function () {
  var seen = {};
  SKR04.KONTEN.forEach(function (k) {
    ok(!seen[k.nr], 'Doppelte Kontonummer ' + k.nr);
    seen[k.nr] = true;
  });
});
test('SKR04: KAT_GUV-Ziele sind gueltige GuV-Positionen', function () {
  ['GKV', 'UKV', 'KLEINST'].forEach(function (v) {
    var schema = Positionen.guvSchema(v);
    Object.keys(SKR04.KAT_GUV).forEach(function (kat) {
      var id = SKR04.KAT_GUV[kat][v];
      ok(schema.some(function (p) { return p.id === id; }),
         'KAT_GUV.' + kat + '.' + v + ' -> unbekannte Position ' + id);
    });
  });
});
test('SKR04: vermögensverwaltende Konten vorhanden', function () {
  ok(SKR04.vvKonten().length >= 10, 'zu wenige vv-Konten');
  ok(SKR04.kontoFinden('0820'), 'Beteiligungen (0820) fehlt');
  ok(SKR04.kontoFinden('7000'), 'Erträge aus Beteiligungen (7000) fehlt');
});
test('SKR04: Wertpapier-Abgang hat Ertrags- und Verlustkonto (Trading-GmbH)', function () {
  var ertrag = SKR04.kontoFinden('4906'), verlust = SKR04.kontoFinden('6905');
  ok(ertrag, 'Konto 4906 (Erträge aus Abgang Umlaufvermögen) fehlt');
  ok(verlust, 'Konto 6905 (Verluste aus Abgang Umlaufvermögen) fehlt');
  eq(ertrag.seite, 'ERTRAG', '4906 ist ein Ertragskonto');
  eq(verlust.seite, 'AUFWAND', '6905 ist ein Aufwandskonto');
  ok(verlust.vv, '6905 ist für die vermögensverwaltende GmbH markiert');
});
test('SKR04: Konto für anrechenbare ausländische Quellensteuer (7639)', function () {
  var k = SKR04.kontoFinden('7639');
  ok(k, 'Konto 7639 (anrechenbare ausländische Quellensteuer) fehlt');
  eq(k.seite, 'AUFWAND', '7639 ist ein Aufwandskonto');
  eq(k.kat, 'ertragsteuer', '7639 zählt zu den Steuern vom Einkommen und Ertrag');
});
test('SKR04: mehrere Bankkonten für verschiedene Banken', function () {
  ['1800', '1810', '1820', '1830', '1840'].forEach(function (nr) {
    var k = SKR04.kontoFinden(nr);
    ok(k, 'Bankkonto ' + nr + ' fehlt');
    eq(k.pos, 'B.IV', 'Bankkonto ' + nr + ' muss auf Position B.IV zeigen');
  });
});
test('SKR04: Eröffnungsbilanzkonto 9000 ohne Bilanzseite', function () {
  var ebk = SKR04.kontoFinden('9000');
  ok(ebk, 'Konto 9000 (EBK) fehlt');
  eq(ebk.seite, 'EBK', 'Konto 9000 muss seite EBK haben (kein AKTIV/PASSIV)');
  ok(!ebk.pos && !ebk.kat, 'EBK darf keine Bilanz-/GuV-Zuordnung haben');
});
test('SKR04: EB_KONTO-Mapping verweist auf gültige Positionen und Bestandskonten', function () {
  var alle = Positionen.AKTIVA.concat(Positionen.PASSIVA);
  ok(SKR04.EB_KONTO, 'EB_KONTO-Mapping fehlt');
  Object.keys(SKR04.EB_KONTO).forEach(function (pos) {
    ok(Positionen.finde(alle, pos), 'EB_KONTO: unbekannte HGB-Position ' + pos);
    var konto = SKR04.kontoFinden(SKR04.EB_KONTO[pos]);
    ok(konto, 'EB_KONTO[' + pos + '] -> Konto ' + SKR04.EB_KONTO[pos] + ' fehlt');
    ok(konto.seite === 'AKTIV' || konto.seite === 'PASSIV',
       'EB_KONTO[' + pos + '] -> Konto ' + konto.nr + ' ist kein Bestandskonto');
  });
});

/* ---- Taxonomie-Mapping ----------------------------------------------- */
test('Taxonomie: Bilanz-Elemente sind nicht leer', function () {
  Object.keys(Taxonomie.BILANZ).forEach(function (id) {
    ok(typeof Taxonomie.BILANZ[id] === 'string' && Taxonomie.BILANZ[id].length > 3,
       'Element für ' + id + ' ungueltig');
  });
  ok(Taxonomie.BILANZ['AKTIVA_SUMME'] === 'bs.ass', 'Bilanzsumme Aktiva');
  ok(Taxonomie.BILANZ['PASSIVA_SUMME'] === 'bs.eqLiab', 'Bilanzsumme Passiva');
});
test('Taxonomie: GuV-Elemente sind nicht leer', function () {
  Object.keys(Taxonomie.GUV).forEach(function (id) {
    ok(typeof Taxonomie.GUV[id] === 'string' && Taxonomie.GUV[id].length > 3,
       'GuV-Element für ' + id + ' ungueltig');
  });
});

/* ---- XBRL-Erzeugung --------------------------------------------------- */
test('XBRL: reine Instanz enthaelt xbrli:xbrl und Fakten', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2026-12-31', gjVon: '2026-01-01',
    gjBis: '2026-12-31', groessenklasse: 'KLEINST', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 40000 }, passiva: {}, guv: { 'gkv.1': 80000 } } };
  var x = XBRL.erzeugeXBRL({ name: 'Test GmbH', steuernummer: '1122334455666' }, ja).xml;
  ok(x.indexOf('<xbrli:xbrl') > -1, 'xbrli:xbrl fehlt');
  ok(x.indexOf('de-gaap-ci:bs.ass') > -1, 'Bilanzsumme-Fakt fehlt');
  ok(x.indexOf('contextRef="D"') > -1, 'Zeitraum-Kontext fehlt');
});
test('XBRL: EBilanz-Container mit Stichtag', function () {
  var eb = { art: 'EROEFFNUNGSBILANZ', stichtag: '2026-03-01', groessenklasse: 'KLEINST',
    kapital: { gezeichnet: 25000, eingezahlt: 12500, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 12500 }, passiva: {}, guv: {} } };
  var x = XBRL.erzeugeEBilanz({ name: 'Test GmbH', steuernummer: '1122334455666' }, eb).xml;
  ok(x.indexOf('<EBilanz') > -1, 'EBilanz-Container fehlt');
  ok(x.indexOf('<stichtag>20260301</stichtag>') > -1, 'Stichtag falsch formatiert');
});
test('XBRL: ist wohlgeformtes XML', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2026-12-31', gjVon: '2026-01-01',
    gjBis: '2026-12-31', groessenklasse: 'KLEIN', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 5000 }, passiva: {}, guv: { 'gkv.1': 10000 } } };
  var x = XBRL.erzeugeEBilanz({ name: 'T', steuernummer: '1234567890123' }, ja).xml;
  var fs = require('fs'), cp = require('child_process'),
      os = require('os'), p = require('path');
  try { cp.execSync('python3 --version', { stdio: 'ignore' }); }
  catch (e) { return; }   // ohne python3 nicht pruefbar -> ueberspringen
  var tmp = p.join(os.tmpdir(), 'gv-xmltest-' + Date.now() + '.xml');
  fs.writeFileSync(tmp, x);
  try {
    cp.execSync('python3 -c "import xml.dom.minidom,sys;xml.dom.minidom.parse(sys.argv[1])" ' +
      tmp, { stdio: 'ignore' });
  } catch (e) { fs.unlinkSync(tmp); throw new Error('XML nicht wohlgeformt'); }
  fs.unlinkSync(tmp);
});
test('XBRL: Kontennachweis gruppiert die Kontensalden nach HGB-Position', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2025-12-31',
    buchungen: [ { soll: '1800', haben: '4400', betrag: 1000 },
                 { soll: '6310', haben: '1800', betrag: 200 } ] };
  var kn = XBRL.kontennachweis(ja);
  var bIV = kn.filter(function (g) { return g.position === 'B.IV'; })[0];
  ok(bIV, 'B.IV (Bank) als Positionsgruppe');
  eq(bIV.konten[0].nr, '1800', 'Konto 1800 unter B.IV');
  eq(bIV.konten[0].saldo, 800, 'Saldo Konto 1800 = 1000 - 200');
});
test('XBRL: Haertefall-Feld bei Direkteingabe ohne Buchungen', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2025-12-31',
    werte: { aktiva: {}, passiva: {}, guv: {} } };
  var r = XBRL.erzeugeXBRL({ steuernummer: '1234567890123' }, ja);
  ok(r.xml.indexOf('transmissionNotYetPossible') >= 0, 'Haertefall-Feld gesetzt');
});

/* ---- Steuerberechnung (vv-GmbH) -------------------------------------- */
test('Steuer: § 8b - 95 % der Dividenden steuerfrei', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, beteiligungsertraege: 100000 } };
  var g = { werte: {}, jahresergebnis: 100000 };
  var s = Steuer.berechne(ja, g);
  eq(s.kst.zvE, 5000, 'zvE = 5 % von 100.000');
  eq(s.kst.betrag, 750, 'KSt 15 % von 5.000');
});
test('Steuer: Streubesitz < 10 % - Dividende voll KSt-pflichtig', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, beteiligungsertraege: 100000,
    beteiligungUnter10: true } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.zvE, 100000, 'zvE voll steuerpflichtig');
});
test('Steuer: erweiterte Kürzung § 9 Nr. 1 GewStG', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, erweiterteKuerzung: true,
    immobilienertrag: 80000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 80000 });
  eq(s.gewst.betrag, 0, 'erweiterte Kürzung -> keine Gewerbesteuer auf Immobilienertrag');
});
test('Steuer: § 8b Abs. 7 - Anteile im Handelsbestand voll steuerpflichtig', function () {
  var g = { werte: {}, jahresergebnis: 100000 };
  var ohne = Steuer.berechne({ steuer: { hebesatz: 400, beteiligungsertraege: 100000 } }, g);
  var mit = Steuer.berechne({ steuer: { hebesatz: 400, beteiligungsertraege: 100000,
    finanzunternehmen: true } }, g);
  eq(ohne.kst.zvE, 5000, '95 % steuerfrei ohne § 8b Abs. 7');
  eq(mit.kst.zvE, 100000, 'voll steuerpflichtig mit § 8b Abs. 7');
});
test('Steuer: KSt 15 % + Soli 5,5 % korrekt', function () {
  var s = Steuer.berechne({ steuer: { hebesatz: 400 } }, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.betrag, 15000, 'KSt');
  eq(s.kst.soli, 825, 'Soli');
});
test('Steuer: KSt-Satz jahresabhängig (Investitionssofortprogramm)', function () {
  eq(Steuer.kstSatz(2027), 0.15, 'Satz VZ 2027');
  eq(Steuer.kstSatz(2028), 0.14, 'Satz VZ 2028');
  eq(Steuer.kstSatz(2030), 0.12, 'Satz VZ 2030');
  eq(Steuer.kstSatz(2033), 0.10, 'Satz ab VZ 2032');
  eq(Steuer.kstSatz(0), 0.15, 'ohne VZ -> aktueller Satz');
});
test('Steuer: KSt-Betrag folgt dem VZ des Abschlusses', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2028-12-31', steuer: { hebesatz: 400 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.satz, 0.14, 'Satz aus VZ 2028');
  eq(s.kst.betrag, 14000, 'KSt VZ 2028');
});
test('Steuer: ausländische Quellensteuer wird auf die KSt angerechnet (§ 26 KStG)', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, auslQuellensteuer: 2000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.kst.betrag, 15000, 'KSt brutto unverändert (15 % von 100.000)');
  eq(s.kst.auslQuellensteuer, 2000, 'Quellensteuer voll angerechnet');
});
test('Steuer: Quellensteuer-Anrechnung auf den Höchstbetrag (KSt) begrenzt', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, auslQuellensteuer: 9999 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 10000 });
  eq(s.kst.betrag, 1500, 'KSt 15 % von 10.000');
  eq(s.kst.auslQuellensteuer, 1500, 'Anrechnung auf die anfallende KSt begrenzt');
});
test('Steuer: Quellensteuer mindert die Gesamtsteuer', function () {
  var g = { werte: {}, jahresergebnis: 100000 };
  var ohne = Steuer.berechne({ steuer: { hebesatz: 400 } }, g);
  var mit  = Steuer.berechne({ steuer: { hebesatz: 400, auslQuellensteuer: 2000 } }, g);
  eq(ohne.gesamtsteuer - mit.gesamtsteuer, 2000, 'Gesamtsteuer um die Anrechnung niedriger');
});

/* ---- UStVA / Versteuerungsart ---------------------------------------- */
test('UStVA: Kennzahlen aus Erlös- und Vorsteuerkonten', function () {
  var bu = [
    { datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 10000 },  // Erlös 19 %
    { datum: '2026-03-10', soll: '1200', haben: '3806', betrag: 1900 },   // USt 19 %
    { datum: '2026-03-12', soll: '1406', haben: '1800', betrag: 570 },    // Vorsteuer 19 %
    { datum: '2026-03-12', soll: '6300', haben: '1800', betrag: 3000 }
  ];
  var u = Ustva.berechne(bu, '2026-03-01', '2026-03-31');
  eq(u.kz81, 10000, 'Kz 81 (Umsätze 19 %)');
  eq(u.ust19, 1900, 'USt 19 %');
  eq(u.kz66, 570, 'Kz 66 (abziehbare Vorsteuer)');
  eq(u.kz83, 1330, 'Kz 83 (Zahllast) = 1900 - 570');
  eq(u.ustGebucht, 1900, 'gebuchte USt aus Konto 3806');
});
test('UStVA: Versteuerungsart - Standard ist Soll', function () {
  var u = Ustva.berechne([], null, null);
  eq(u.versteuerungsart, 'soll', 'Standard Soll');
  eq(u.hinweise.length, 0, 'keine Hinweise');
});
test('UStVA: Ist-Versteuerung warnt bei Erlös über Forderungskonto', function () {
  var bu = [{ datum: '2026-05-02', soll: '1200', haben: '4400', betrag: 5000 }];
  var ist  = Ustva.berechne(bu, null, null, { versteuerungsart: 'ist' });
  var soll = Ustva.berechne(bu, null, null, { versteuerungsart: 'soll' });
  eq(ist.versteuerungsart, 'ist', 'Art ist');
  eq(ist.hinweise.length, 1, 'Ist: Hinweis auf Forderungsbuchung');
  eq(soll.hinweise.length, 0, 'Soll: kein Hinweis');
});
test('UStVA: Ist-Versteuerung ohne Forderungsbuchung - kein Hinweis', function () {
  // Erlös direkt über Bank gebucht (Zahlungseingang) -> Ist-konform
  var bu = [{ datum: '2026-05-02', soll: '1800', haben: '4400', betrag: 5000 }];
  var u = Ustva.berechne(bu, null, null, { versteuerungsart: 'ist' });
  eq(u.hinweise.length, 0, 'kein Hinweis bei Buchung über Geldkonto');
});
test('UStVA: Zeitraumfilter grenzt Buchungen ab', function () {
  var bu = [
    { datum: '2026-01-15', soll: '1800', haben: '4400', betrag: 1000 },
    { datum: '2026-02-15', soll: '1800', haben: '4400', betrag: 2000 }
  ];
  eq(Ustva.berechne(bu, '2026-01-01', '2026-01-31').kz81, 1000, 'nur Januar-Umsatz');
  eq(Ustva.berechne(bu, null, null).kz81, 3000, 'ohne Filter beide Umsätze');
});
test('UStVA: Kleinunternehmer § 19 - keine USt, kein Vorsteuerabzug', function () {
  var bu = [{ datum: '2026-04-01', soll: '1406', haben: '1800', betrag: 570 }];
  var u = Ustva.berechne(bu, null, null, { kleinunternehmer: true });
  eq(u.kleinunternehmer, true, 'Kleinunternehmer-Flag');
  eq(u.kz66, 0, 'kein Vorsteuerabzug');
  eq(u.kz83, 0, 'keine Zahllast');
  ok(u.hinweise.length >= 1, 'Hinweis zur Kleinunternehmerregelung');
});
test('UStVA: § 13b - amtliche Kennzahlen: Kz 84 = Bemessungsgrundlage, Kz 85 = Steuer, Kz 67 = Vorsteuer', function () {
  // Rechts-Review 2026-06-10: der amtliche UStVA-Vordruck führt die BEMESSUNGS-
  // GRUNDLAGE der § 13b-Leistungsbezüge in Kz 84, die STEUER darauf in Kz 85 und
  // die abziehbare § 13b-Vorsteuer GETRENNT in Kz 67 (Kz 66 = nur allg. Vorsteuer).
  var u = Ustva.berechne([], null, null, { rc13b: { netto19: 1000 } });
  eq(u.kz84, 1000, 'Kz 84 = Bemessungsgrundlage (netto) 1.000');
  eq(u.kz85, 190, 'Kz 85 = Steuer 19 % von 1.000');
  eq(u.kz66, 0, 'Kz 66 nur allgemeine Vorsteuer (hier keine)');
  eq(u.kz67, 190, 'Kz 67 = § 13b-Steuer als Vorsteuer abziehbar');
  eq(u.kz83, 0, 'netto Null bei voller Abzugsberechtigung');
});
test('UStVA: § 13b zusätzlich zur eigenen Umsatzsteuer', function () {
  var bu = [{ datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 10000 }];
  var u = Ustva.berechne(bu, null, null, { rc13b: { netto19: 2000 } });
  eq(u.ust19, 1900, 'eigene USt 19 %');
  eq(u.kz84, 2000, 'Kz 84 = Bemessungsgrundlage 2.000');
  eq(u.kz85, 380, 'Kz 85 = § 13b-Steuer 19 % von 2.000');
  eq(u.kz83, 1900, 'Zahllast = eigene USt (1900 + 380 - 0 - 380)');
});
test('UStVA: § 13b mit allgemeiner Vorsteuer — Kz 66/67 getrennt, Zahllast korrekt', function () {
  var bu = [
    { datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 10000 },
    { datum: '2026-01-12', soll: '1406', haben: '1800', betrag: 570 }
  ];
  var u = Ustva.berechne(bu, null, null, { rc13b: { netto19: 1000 } });
  eq(u.kz66, 570, 'Kz 66 = nur allgemeine Vorsteuer');
  eq(u.kz67, 190, 'Kz 67 = § 13b-Vorsteuer getrennt');
  eq(u.kz83, 1330, 'Zahllast 1900 + 190 - 570 - 190');
});
test('UStVA: steuerfreie Umsätze ohne Vorsteuerabzug melden Kz 48 + Hinweis', function () {
  var u = Ustva.berechne([], null, null, { steuerfrei: { ohneVorsteuer: 12000 } });
  eq(u.kz48, 12000, 'Kz 48 (steuerfrei ohne Vorsteuerabzug)');
  ok(u.hinweise.some(function (h) { return h.indexOf('Vorsteueraufteilung') >= 0; }),
     'Hinweis auf Vorsteueraufteilung § 15 Abs. 4');
});

/* ---- Steuer: Verlustvortrag / Hinzurechnungen / vGA ------------------ */
test('Steuer: Verlustvortrag mindert zu versteuerndes Einkommen', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, verlustvortrag: 30000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 50000 });
  eq(s.kst.zvE, 20000, 'zvE = 50.000 - 30.000 Verlustvortrag');
  eq(s.verlustvortrag.eingesetztKst, 30000, 'voller Verlustvortrag genutzt');
  eq(s.verlustvortrag.restKst, 0, 'kein Restvortrag');
});
test('Steuer: Verlustvortrag begrenzt auf das Einkommen, Rest bleibt', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, verlustvortrag: 80000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 50000 });
  eq(s.kst.zvE, 0, 'zvE auf 0 gemindert');
  eq(s.verlustvortrag.restKst, 30000, 'Restvortrag 80.000 - 50.000');
});
test('Steuer: Mindestbesteuerung § 10d - Standardquote 60 % über 1 Mio EUR', function () {
  var r = Steuer.verlustabzug(2000000, 5000000);
  eq(r.abzug, 1600000, 'abziehbar: 1 Mio voll + 60 % von 1 Mio');
  eq(r.rest, 3400000, 'verbleibender Vortrag');
});
test('Steuer: mindestbestQuoteKSt - 70 % VZ 2024-2027, sonst 60 %', function () {
  eq(Steuer.mindestbestQuoteKSt(2026), 0.70, 'VZ 2026');
  eq(Steuer.mindestbestQuoteKSt(2027), 0.70, 'VZ 2027');
  eq(Steuer.mindestbestQuoteKSt(2028), 0.60, 'VZ 2028 - Rückkehr zu 60 %');
  eq(Steuer.mindestbestQuoteKSt(2023), 0.60, 'VZ 2023 - vor der Anhebung');
});
test('Steuer: verlustabzug mit 70-%-Quote (KSt-Mindestbesteuerung 2024-2027)', function () {
  var r = Steuer.verlustabzug(2000000, 5000000, 0.70);
  eq(r.abzug, 1700000, 'abziehbar: 1 Mio voll + 70 % von 1 Mio');
  eq(r.rest, 3300000, 'verbleibender Vortrag');
});
test('Steuer: KSt nutzt 70 %, GewSt 60 % beim Verlustvortrag (VZ 2026)', function () {
  var ja = { art: 'JAHRESABSCHLUSS', stichtag: '2026-12-31',
    steuer: { hebesatz: 400, verlustvortrag: 5000000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 2000000 });
  eq(s.verlustvortrag.eingesetztKst, 1700000, 'KSt: 70 % über dem Sockelbetrag (VZ 2026)');
  eq(s.verlustvortrag.eingesetztGewSt, 1600000, 'GewSt: durchgehend 60 %');
});
test('Steuer: einfache Kürzung § 9 Nr. 1 - gezahlte Grundsteuer', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, gezahlteGrundsteuer: 8000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.gewst.gewerbeertrag, 92000, 'Gewerbeertrag um die gezahlte Grundsteuer gekürzt');
});
test('Steuer: GewSt-Hinzurechnung § 8 Nr. 1 über Freibetrag', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, zinsaufwand: 250000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.hinzurechnungGewSt, 12500, '25 % von (250.000 - 200.000 Freibetrag)');
  eq(s.gewst.gewerbeertrag, 112500, 'Gewerbeertrag inkl. Hinzurechnung');
});
test('Steuer: GewSt-Hinzurechnung bleibt unter Freibetrag aus', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, zinsaufwand: 50000,
    mietenUnbeweglich: 100000 } };   // Basis 50.000 + 50 % v. 100.000 = 100.000
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 100000 });
  eq(s.hinzurechnungGewSt, 0, 'unter 200.000 EUR keine Hinzurechnung');
});
test('Steuer: verdeckte Gewinnausschüttung erhöht KSt- und GewSt-Basis', function () {
  var ja = { art: 'JAHRESABSCHLUSS', steuer: { hebesatz: 400, vga: 20000 } };
  var s = Steuer.berechne(ja, { werte: {}, jahresergebnis: 50000 });
  eq(s.kst.zvE, 70000, 'zvE = 50.000 + 20.000 vGA');
  eq(s.gewst.gewerbeertrag, 70000, 'Gewerbeertrag inkl. vGA');
  ok(s.hinweise.some(function (h) { return h.indexOf('Gewinnausschüttung') >= 0; }),
     'vGA-Hinweis vorhanden');
});

/* ---- Bankimport MT940 ------------------------------------------------ */
test('MT940: liest Umsätze mit Betrag, Richtung und Verwendungszweck', function () {
  var sta = [
    ':20:STARTUMS', ':25:10010010/1234567', ':28C:00012/001',
    ':60F:C240301EUR1000,00',
    ':61:2403150315C1500,00NTRFNONREF',
    ':86:166?00GUTSCHRIFT?20Rechnung 2024-005?32MUSTER GMBH',
    ':61:2403160316D250,50NTRFNONREF',
    ':86:177?00LASTSCHRIFT?20Stromabschlag?32STADTWERKE',
    ':62F:C240331EUR2249,50'
  ].join('\n');
  var r = Mt940.parse(sta);
  eq(r.tx.length, 2, 'zwei Umsätze');
  eq(r.tx[0].datum, '2024-03-15', 'Wertstellungsdatum');
  eq(r.tx[0].betrag, 1500, 'Betrag Gutschrift');
  eq(r.tx[0].eingang, true, 'C-Kennzeichen = Eingang');
  eq(r.tx[0].zweck, 'Rechnung 2024-005', 'Verwendungszweck aus ?20');
  eq(r.tx[0].partner, 'MUSTER GMBH', 'Partner aus ?32');
  eq(r.tx[1].eingang, false, 'D-Kennzeichen = Ausgang');
  eq(r.tx[1].betrag, 250.5, 'Betrag Lastschrift');
});
test('MT940: meldet Fehler bei fremdem Format', function () {
  ok(Mt940.parse('irgendein Text ohne Tags').fehler, 'Fehler bei Nicht-MT940-Datei');
});

/* ---- DATEV-Import (EXTF) --------------------------------------------- */
test('DATEV: liest EXTF-Buchungsstapel mit Soll/Haben-Richtung', function () {
  var extf = [
    '"EXTF";700;21;"Buchungsstapel";13;20260518;;"";"OpenBilanz";"";;;20260101;4;' +
      '20260101;20261231;;;1;;0;"EUR"',
    'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;' +
      'WKZ Basis-Umsatz;Konto;Gegenkonto;BU-Schluessel;Belegdatum;Belegfeld 1;' +
      'Belegfeld 2;Skonto;Buchungstext',
    '1500,00;S;EUR;;;;1800;4400;;1503;;;;"Erloes Maerz"',
    '250,50;H;EUR;;;;1800;6310;;1603;;;;"Miete"'
  ].join('\r\n');
  var r = Datev.parse(extf);
  eq(r.buchungen.length, 2, 'zwei Buchungen');
  eq(r.jahr, '2026', 'Jahr aus dem Kopfsatz');
  eq(r.buchungen[0].soll, '1800', 'S-Kennzeichen: Konto ist Soll');
  eq(r.buchungen[0].haben, '4400', 'Gegenkonto ist Haben');
  eq(r.buchungen[0].betrag, 1500, 'Betrag');
  eq(r.buchungen[0].datum, '2026-03-15', 'Belegdatum TTMM + Jahr');
  eq(r.buchungen[1].soll, '6310', 'H-Kennzeichen: Gegenkonto ist Soll');
  eq(r.buchungen[1].haben, '1800', 'Konto ist Haben');
});
test('DATEV: meldet Fehler ohne EXTF-Kopfzeile', function () {
  ok(Datev.parse('a;b;c\n1;2;3').fehler, 'Fehler ohne EXTF-Kopf');
});
test('DATEV-Export: erzeugt EXTF-Buchungsstapel mit Kopf und Buchungszeile', function () {
  var a = { bezeichnung: 'JA 2026', gjVon: '2026-01-01', gjBis: '2026-12-31',
    buchungen: [ { datum: '2026-03-15', soll: '1800', haben: '4400',
      betrag: 1190, text: 'Erlös' } ] };
  var extf = Datev.erzeuge(a, {});
  var zeilen = extf.replace(/^﻿/, '').replace(/\r\n$/, '').split('\r\n');
  eq(zeilen.length, 3, 'Kopfsatz + Spaltenzeile + 1 Buchungszeile');
  ok(zeilen[0].indexOf('"EXTF"') === 0, 'EXTF-Kopfsatz');
  ok(zeilen[2].indexOf('1190,00') >= 0, 'Betrag mit Dezimalkomma');
  ok(zeilen[2].indexOf('1503') >= 0, 'Belegdatum als TTMM');
});
test('DATEV-Export: Rückimport ergibt dieselbe Buchung (Roundtrip)', function () {
  var a = { bezeichnung: 'JA 2026', gjVon: '2026-01-01', gjBis: '2026-12-31',
    buchungen: [ { datum: '2026-03-15', soll: '1800', haben: '4400',
      betrag: 1190, text: 'Erlös' } ] };
  var r = Datev.parse(Datev.erzeuge(a, {}));
  ok(!r.fehler, 'erzeugter Stapel ist wieder einlesbar');
  eq(r.buchungen.length, 1, 'eine Buchung');
  eq(r.buchungen[0].soll, '1800', 'Soll-Konto erhalten');
  eq(r.buchungen[0].haben, '4400', 'Haben-Konto erhalten');
  eq(r.buchungen[0].betrag, 1190, 'Betrag erhalten');
  eq(r.buchungen[0].datum, '2026-03-15', 'Belegdatum erhalten');
});

/* ---- Journal-Export CSV / JSON --------------------------------------- */
test('Journal-Export: CSV mit Kopfzeile und einer Zeile je Buchung', function () {
  var a = { buchungen: [
    { datum: '2026-03-01', soll: '1800', haben: '4400', betrag: 1190, text: 'Erlös', fest: true },
    { datum: '2026-03-05', soll: '6300', haben: '1800', betrag: 50, text: 'Büro' }
  ] };
  var zeilen = JournalExport.csv(a).replace(/^﻿/, '').replace(/\r\n$/, '').split('\r\n');
  eq(zeilen.length, 3, 'Kopfzeile + 2 Buchungen');
  eq(zeilen[0], 'Datum;Soll;Haben;Betrag;Text;Festgeschrieben', 'Kopfzeile');
  ok(zeilen[1].indexOf('1190,00') >= 0, 'Betrag mit Dezimalkomma');
  ok(zeilen[1].indexOf(';ja') >= 0 && zeilen[2].indexOf(';nein') >= 0, 'Festschreibungs-Spalte');
});
test('Journal-Export: JSON ist gültig und enthält die Buchungen', function () {
  var a = { id: 'A-1', bezeichnung: 'JA 2026', buchungen: [
    { datum: '2026-03-01', soll: '1800', haben: '4400', betrag: 100, text: 'x' }
  ] };
  var o = JSON.parse(JournalExport.json(a));
  eq(o.format, 'openbilanz-journal', 'Format-Kennung');
  eq(o.buchungen.length, 1, 'eine Buchung');
  eq(o.buchungen[0].betrag, 100, 'Betrag');
  eq(o.buchungen[0].festgeschrieben, false, 'Festschreibungs-Flag');
});
/* ---- GDPdU-Export ---------------------------------------------------- */
test('GDPdU-Export: CSV-Datenzeilen und beschreibende index.xml', function () {
  var a = { bezeichnung: 'JA 2026', gjVon: '2026-01-01', gjBis: '2026-12-31',
    buchungen: [ { datum: '2026-03-01', soll: '1800', haben: '4400',
      betrag: 1190, text: 'Erlös' } ] };
  var g = Gdpdu.erzeuge(a, { name: 'Test GmbH', ort: 'Berlin' });
  var zeilen = g.csv.replace(/\r\n$/, '').split('\r\n');
  eq(zeilen.length, 1, 'eine Datenzeile (ohne Kopf - Spalten beschreibt index.xml)');
  ok(zeilen[0].indexOf('1190,00') >= 0, 'Betrag mit Dezimalkomma');
  ok(g.indexXml.indexOf('<!DOCTYPE DataSet') >= 0, 'GDPdU-DTD referenziert');
  ok(g.indexXml.indexOf('<VariableColumn>') >= 0, 'Spaltenbeschreibung enthalten');
  ok(g.indexXml.indexOf(g.csvDateiname) >= 0, 'index.xml verweist auf die CSV-Datei');
});

/* ---- Prüfkette (Integrität festgeschriebener Buchungen) -------------- */
test('Prüfkette: SHA-256 stimmt mit den FIPS-180-4-Testvektoren', function () {
  eq(Pruefkette.sha256('abc'),
     'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256("abc")');
  eq(Pruefkette.sha256(''),
     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256("")');
});
test('Prüfkette: verkettet festgeschriebene Buchungen und prüft sie', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 1190, text: 'a', fest: true },
    { id: 'B-2', datum: '2026-01-12', soll: '6300', haben: '1800', betrag: 50, text: 'b', fest: true },
    { id: 'B-3', datum: '2026-01-15', soll: '1800', haben: '4400', betrag: 200, text: 'c' }
  ];
  Pruefkette.fortschreiben(bu);
  ok(bu[0].hash && bu[1].hash, 'festgeschriebene Buchungen erhalten einen Hash');
  ok(!bu[2].hash, 'nicht festgeschriebene Buchung bleibt ohne Hash');
  var r = Pruefkette.pruefe(bu);
  eq(r.ok, true, 'Kette intakt');
  eq(r.anzahl, 2, 'zwei verkettete Buchungen');
});
test('Prüfkette: erkennt nachträgliche Änderung einer Buchung', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 1190, text: 'a', fest: true },
    { id: 'B-2', datum: '2026-01-12', soll: '6300', haben: '1800', betrag: 50, text: 'b', fest: true }
  ];
  Pruefkette.fortschreiben(bu);
  bu[0].betrag = 9999;   // Manipulation nach der Festschreibung
  var r = Pruefkette.pruefe(bu);
  eq(r.ok, false, 'Manipulation erkannt');
  eq(r.bruchId, 'B-1', 'die gebrochene Buchung wird benannt');
});
test('Prüfkette: spätere Festschreibung verlängert die Kette stabil', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 100, text: 'a', fest: true }
  ];
  Pruefkette.fortschreiben(bu);
  var h1 = bu[0].hash;
  bu.push({ id: 'B-2', datum: '2026-02-01', soll: '1800', haben: '4400', betrag: 200, text: 'b', fest: true });
  Pruefkette.fortschreiben(bu);
  eq(bu[0].hash, h1, 'bestehende Buchung behält ihren Hash');
  eq(Pruefkette.pruefe(bu).ok, true, 'die verlängerte Kette ist intakt');
});
test('Prüfkette: Storno-Markierung bricht die Kette nicht', function () {
  var bu = [
    { id: 'B-1', datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 100, text: 'a', fest: true }
  ];
  Pruefkette.fortschreiben(bu);
  bu[0].storniert = true;   // zulässige Storno-Markierung, kein Inhaltswechsel
  eq(Pruefkette.pruefe(bu).ok, true, 'Storno-Flag zählt nicht zum Buchungsinhalt');
});

/* ---- Bankimport-Kontierungsregeln ------------------------------------ */
test('Bankimport: nutzerdefinierte Kontierungsregel hat Vorrang', function () {
  var regeln = [{ muster: 'Stadtwerke', konto: '6325' }];
  eq(Importe.bankKontoVorschlag('Abschlag STADTWERKE Musterstadt', false, regeln), '6325',
     'Nutzerregel greift (Teilstring, Groß-/Kleinschreibung egal)');
  eq(Importe.bankKontoVorschlag('Miete Büro', false, regeln), '6310',
     'eingebaute Regel greift weiterhin');
  eq(Importe.bankKontoVorschlag('Unbekannter Umsatz', false, regeln), '6300',
     'Rückfall auf sonstige Aufwendungen ohne Treffer');
  eq(Importe.bankKontoVorschlag('Unbekannter Umsatz', true, []), '4400',
     'Rückfall auf Umsatzerlöse bei einem Eingang');
});

/* ---- E-Rechnung (XRechnung / ZUGFeRD) -------------------------------- */
/* Fixture: UBL-XRechnung 3.x (CIUS EN 16931) mit einer Position. */
var FIXTURE_UBL = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
  ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
  ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
  '<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>',
  '<cbc:ID>RE-2026-0815</cbc:ID>',
  '<cbc:IssueDate>2026-05-12</cbc:IssueDate>',
  '<cac:AccountingSupplierParty><cac:Party>',
  '<cac:PartyLegalEntity><cbc:RegistrationName>Mustermann Beratung GmbH</cbc:RegistrationName></cac:PartyLegalEntity>',
  '</cac:Party></cac:AccountingSupplierParty>',
  '<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount></cac:TaxTotal>',
  '<cac:LegalMonetaryTotal>',
  '<cbc:TaxExclusiveAmount currencyID="EUR">100.00</cbc:TaxExclusiveAmount>',
  '<cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>',
  '<cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>',
  '</cac:LegalMonetaryTotal>',
  '<cac:InvoiceLine>',
  '<cbc:ID>1</cbc:ID>',
  '<cbc:InvoicedQuantity unitCode="HUR">2</cbc:InvoicedQuantity>',
  '<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>',
  '<cac:Item><cbc:Name>Beratungsleistung</cbc:Name>',
  '<cac:ClassifiedTaxCategory><cbc:Percent>19.00</cbc:Percent></cac:ClassifiedTaxCategory></cac:Item>',
  '<cac:Price><cbc:PriceAmount currencyID="EUR">50.00</cbc:PriceAmount></cac:Price>',
  '</cac:InvoiceLine>',
  '</Invoice>'].join('\n');

/* Fixture: CII Factur-X BASIC, eine Position, Verkäufer mit Umlaut. */
var FIXTURE_CII = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
  ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
  ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  '<rsm:ExchangedDocumentContext>',
  '<ram:GuidelineSpecifiedDocumentContextParameter>',
  '<ram:ID>urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:basic</ram:ID>',
  '</ram:GuidelineSpecifiedDocumentContextParameter>',
  '</rsm:ExchangedDocumentContext>',
  '<rsm:ExchangedDocument>',
  '<ram:ID>2026-CII-007</ram:ID>',
  '<ram:IssueDateTime><udt:DateTimeString format="102">20260512</udt:DateTimeString></ram:IssueDateTime>',
  '</rsm:ExchangedDocument>',
  '<rsm:SupplyChainTradeTransaction>',
  '<ram:IncludedSupplyChainTradeLineItem>',
  '<ram:SpecifiedTradeProduct><ram:Name>Schraube M6 x 30</ram:Name></ram:SpecifiedTradeProduct>',
  '<ram:SpecifiedLineTradeAgreement>',
  '<ram:NetPriceProductTradePrice><ram:ChargeAmount>0.10</ram:ChargeAmount></ram:NetPriceProductTradePrice>',
  '</ram:SpecifiedLineTradeAgreement>',
  '<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="H87">100</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>',
  '<ram:SpecifiedLineTradeSettlement>',
  '<ram:ApplicableTradeTax><ram:RateApplicablePercent>19.00</ram:RateApplicablePercent></ram:ApplicableTradeTax>',
  '<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>10.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>',
  '</ram:SpecifiedLineTradeSettlement>',
  '</ram:IncludedSupplyChainTradeLineItem>',
  '<ram:ApplicableHeaderTradeAgreement>',
  '<ram:SellerTradeParty><ram:Name>Eisenwaren Bäcker GmbH</ram:Name></ram:SellerTradeParty>',
  '</ram:ApplicableHeaderTradeAgreement>',
  '<ram:ApplicableHeaderTradeSettlement>',
  '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
  '<ram:TaxBasisTotalAmount>10.00</ram:TaxBasisTotalAmount>',
  '<ram:TaxTotalAmount currencyID="EUR">1.90</ram:TaxTotalAmount>',
  '<ram:GrandTotalAmount>11.90</ram:GrandTotalAmount>',
  '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
  '</ram:ApplicableHeaderTradeSettlement>',
  '</rsm:SupplyChainTradeTransaction>',
  '</rsm:CrossIndustryInvoice>'].join('\n');

test('E-Rechnung: UBL-XRechnung 3.x — Header, Profil, Position', function () {
  var r = Importe.parseERechnung(FIXTURE_UBL).rechnung;
  eq(r.nummer, 'RE-2026-0815', 'Rechnungsnummer');
  eq(r.datum, '2026-05-12', 'Rechnungsdatum');
  eq(r.verkaeufer, 'Mustermann Beratung GmbH', 'Verkäufer (Legal Entity)');
  eq(r.netto, 100, 'Netto');
  eq(r.ust, 19, 'USt');
  eq(r.brutto, 119, 'Brutto');
  ok(/XRechnung 3/.test(r.profil), 'Profil als XRechnung 3.x erkannt');
  eq(r.positionen.length, 1, 'eine Position');
  eq(r.positionen[0].bezeichnung, 'Beratungsleistung', 'Positions-Bezeichnung');
  eq(r.positionen[0].menge, 2, 'Menge');
  eq(r.positionen[0].einheit, 'HUR', 'Einheit (Stunden)');
  eq(r.positionen[0].einzelpreis, 50, 'Einzelpreis');
  eq(r.positionen[0].netto, 100, 'Positions-Netto');
  eq(r.positionen[0].ustSatz, 19, 'Steuersatz');
  eq(r.warnungen.length, 0, 'keine Plausi-Warnungen');
});

test('E-Rechnung: CII Factur-X BASIC — Header, Profil, Position, Umlaut', function () {
  var r = Importe.parseERechnung(FIXTURE_CII).rechnung;
  eq(r.nummer, '2026-CII-007', 'Rechnungsnummer');
  eq(r.datum, '2026-05-12', 'Rechnungsdatum');
  eq(r.verkaeufer, 'Eisenwaren Bäcker GmbH', 'Verkäufer mit Umlaut');
  eq(r.netto, 10, 'Netto');
  eq(r.ust, 1.9, 'USt');
  eq(r.brutto, 11.9, 'Brutto');
  ok(/BASIC/.test(r.profil), 'Profil als Factur-X BASIC erkannt');
  eq(r.positionen.length, 1, 'eine Position');
  eq(r.positionen[0].bezeichnung, 'Schraube M6 x 30', 'Positions-Bezeichnung');
  eq(r.positionen[0].menge, 100, 'Menge');
  eq(r.positionen[0].einheit, 'H87', 'Einheit (Stück)');
  eq(r.positionen[0].einzelpreis, 0.1, 'Einzelpreis');
  eq(r.warnungen.length, 0, 'keine Plausi-Warnungen');
});

test('E-Rechnung: Plausi schlägt an, wenn Brutto ≠ Netto + USt', function () {
  /* Brutto absichtlich falsch: 120 statt 119. */
  var xml = FIXTURE_UBL
    .replace('<cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>',
             '<cbc:TaxInclusiveAmount currencyID="EUR">120.00</cbc:TaxInclusiveAmount>')
    .replace('<cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>',
             '<cbc:PayableAmount currencyID="EUR">120.00</cbc:PayableAmount>');
  var r = Importe.parseERechnung(xml).rechnung;
  ok(r.warnungen.some(function (w) { return /Brutto/.test(w); }),
     'Brutto-Mismatch-Warnung gesetzt');
});

test('E-Rechnung: kein XML → klare Fehlermeldung', function () {
  var r = Importe.parseERechnung('Das ist kein XML');
  ok(r.fehler && /XML/.test(r.fehler), 'Fehler ausgewiesen');
});

test('E-Rechnung: XML ohne Rechnungsbeträge → Fehlermeldung', function () {
  var r = Importe.parseERechnung('<root><foo>bar</foo></root>');
  ok(r.fehler && /Rechnungsbeträge/.test(r.fehler), 'Fehler wegen fehlender Summen');
});

test('E-Rechnung: ZUGFeRD-PDF (deflate-komprimierte CII-XML) wird extrahiert', function () {
  var zlib = require('zlib');
  var compressed = zlib.deflateSync(Buffer.from(FIXTURE_CII, 'utf8'));
  var pre = Buffer.from(
    '%PDF-1.7\n' +
    '1 0 obj\n' +
    '<< /Type /Filespec /F (factur-x.xml) /UF (factur-x.xml) ' +
    '/EF << /F 2 0 R /UF 2 0 R >> /AFRelationship /Source >>\n' +
    'endobj\n' +
    '2 0 obj\n' +
    '<< /Type /EmbeddedFile /Subtype /text#2Fxml /Length ' + compressed.length +
    ' /Filter /FlateDecode >>\nstream\n', 'latin1');
  var post = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
  var pdf = Buffer.concat([pre, compressed, post]);
  return Importe.parseERechnungPdf(pdf).then(function (r) {
    ok(!r.fehler, 'kein Fehler: ' + (r.fehler || ''));
    eq(r.rechnung.nummer, '2026-CII-007', 'Rechnungsnummer aus eingebetteter XML');
    eq(r.rechnung.verkaeufer, 'Eisenwaren Bäcker GmbH', 'Umlaut nach Inflate korrekt');
    ok(/BASIC/.test(r.rechnung.profil), 'Profil aus PDF-Anhang erkannt');
  });
});

test('E-Rechnung: PDF ohne EmbeddedFile → Fehlermeldung', function () {
  var pdf = Buffer.from(
    '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'latin1');
  return Importe.parseERechnungPdf(pdf).then(function (r) {
    ok(r.fehler && /EmbeddedFile|XML/.test(r.fehler), 'Fehler ohne Anhang');
  });
});

test('E-Rechnung: Bytes ohne PDF-Magic → klare Fehlermeldung', function () {
  return Importe.parseERechnungPdf(Buffer.from('Hello, world', 'latin1')).then(function (r) {
    ok(r.fehler && /PDF/.test(r.fehler), 'Fehler wegen fehlender Magic-Bytes');
  });
});

/* ---- Ausgangsrechnung: XRechnung-UBL-Renderer ------------------------ */
var EIGENE_TEST = {
  name: 'Lindgrün Software GmbH', strasse: 'Karl-Heine-Straße 47',
  plz: '04229', ort: 'Leipzig', land: 'DE',
  ustId: 'DE298765432', hrNummer: 'HRB 38120',
  bank: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' }
};
function basisRechnung(over) {
  var r = { nummer: 'RE-2026-0001', datum: '2026-05-20', leistungsdatum: '2026-05-19',
    besonderheit: 'NORMAL', kundeSnapshot: { name: 'Müller & Co. KG',
      strasse: 'Hauptstraße 12', plz: '10115', ort: 'Berlin', land: 'DE',
      ustId: 'DE123456789' },
    positionen: [
      { bezeichnung: 'Beratungsleistung Mai 2026', menge: 16, einheit: 'HUR', einzelpreis: 120, ustSatz: 19 },
      { bezeichnung: 'Lizenz CI-Werkzeug',         menge: 1,  einheit: 'C62', einzelpreis: 49.99, ustSatz: 19 }
    ] };
  if (over) Object.keys(over).forEach(function (k) { r[k] = over[k]; });
  return r;
}

test('XRechnung-UBL: Summen aus Positionen berechnen (19 %)', function () {
  var s = XRechnungUBL.summen(basisRechnung());
  eq(s.netto, 1969.99, 'Netto');
  eq(s.ust, 374.30, 'USt');
  eq(s.brutto, 2344.29, 'Brutto');
});

test('XRechnung-UBL: Pflichtcheck — Standardfall ist OK', function () {
  var p = XRechnungUBL.pruefe(basisRechnung(), EIGENE_TEST);
  ok(p.ok, 'OK, Fehler: ' + p.fehler.join('; '));
  eq(p.fehler.length, 0, 'keine Fehler');
});

test('XRechnung-UBL: Pflichtcheck erkennt fehlende Rechnungsnummer', function () {
  var r = basisRechnung(); r.nummer = '';
  var p = XRechnungUBL.pruefe(r, EIGENE_TEST);
  ok(!p.ok, 'Pflichtcheck schlägt an');
  ok(p.fehler.some(function (f) { return /Rechnungsnummer/.test(f); }), 'Nummer-Fehler');
});

test('XRechnung-UBL: Pflichtcheck verlangt USt-ID des Kunden bei §13b', function () {
  var r = basisRechnung(); r.besonderheit = 'REVERSE_CHARGE_13b';
  r.kundeSnapshot.ustId = '';
  var p = XRechnungUBL.pruefe(r, EIGENE_TEST);
  ok(!p.ok, 'Pflichtcheck schlägt an');
  ok(p.fehler.some(function (f) { return /USt-IdNr/.test(f) && /Empfänger/.test(f); }),
     'fordert Empfänger-USt-ID');
});

test('XRechnung-UBL: Pflichtcheck verlangt eigene St-Nr ODER USt-ID', function () {
  var e = Object.assign({}, EIGENE_TEST, { ustId: '', stNr: '' });
  var p = XRechnungUBL.pruefe(basisRechnung(), e);
  ok(!p.ok, 'Pflichtcheck schlägt an');
});

test('XRechnung-UBL: Reverse-Charge erzwingt USt = 0 unabhängig von Position', function () {
  var r = basisRechnung(); r.besonderheit = 'REVERSE_CHARGE_13b';
  var s = XRechnungUBL.summen(r);
  eq(s.ust, 0, 'USt = 0');
  eq(s.brutto, s.netto, 'Brutto = Netto');
});

test('XRechnung-UBL: §19 Kleinunternehmer erzwingt USt = 0', function () {
  var r = basisRechnung(); r.besonderheit = 'KLEINUNTERNEHMER_19';
  var s = XRechnungUBL.summen(r);
  eq(s.ust, 0, 'USt = 0');
});

test('XRechnung-UBL: rendert valides UBL und Roundtrip via parseERechnung stimmt', function () {
  var xml = XRechnungUBL.render(basisRechnung(), EIGENE_TEST);
  ok(/CustomizationID>urn:cen\.eu:en16931/.test(xml), 'CustomizationID gesetzt');
  ok(/xrechnung_3\.0/.test(xml), 'XRechnung-3.0-CIUS');
  ok(/<cbc:InvoiceTypeCode>380<\/cbc:InvoiceTypeCode>/.test(xml), 'TypeCode 380');
  var rt = Importe.parseERechnung(xml).rechnung;
  eq(rt.nummer, 'RE-2026-0001', 'Nummer Roundtrip');
  eq(rt.netto, 1969.99, 'Netto Roundtrip');
  eq(rt.ust, 374.30, 'USt Roundtrip');
  eq(rt.brutto, 2344.29, 'Brutto Roundtrip');
  eq(rt.verkaeufer, 'Lindgrün Software GmbH', 'Verkäufer mit Umlaut');
  ok(/XRechnung 3/.test(rt.profil), 'Profil erkannt');
  eq(rt.positionen.length, 2, 'zwei Positionen');
  eq(rt.warnungen.length, 0, 'keine Plausi-Warnungen');
});

test('XRechnung-UBL: Reverse-Charge-Hinweis als TaxExemptionReason im XML', function () {
  var r = basisRechnung(); r.besonderheit = 'REVERSE_CHARGE_13b';
  var xml = XRechnungUBL.render(r, EIGENE_TEST);
  ok(/<cbc:ID>AE<\/cbc:ID>/.test(xml), 'TaxCategoryCode AE');
  ok(/<cbc:TaxExemptionReason>[^<]*§\s*13b[^<]*<\/cbc:TaxExemptionReason>/.test(xml),
     'Hinweis auf § 13b');
});

test('XRechnung-UBL: SEPA-PaymentMeans wenn IBAN angegeben', function () {
  var xml = XRechnungUBL.render(basisRechnung(), EIGENE_TEST);
  ok(/<cbc:PaymentMeansCode>58<\/cbc:PaymentMeansCode>/.test(xml), 'SEPA-Code 58');
  ok(/DE89370400440532013000/.test(xml), 'IBAN ohne Leerzeichen im XML');
});

/* ---- Ausgangsrechnung: Nummernkreis + Buchungsautomat ---------------- */
test('Ausgangsrechnung: Nummernschema RE-{JAHR}-{NR:04} füllt mit Nullen', function () {
  eq(Ausgangsrechnung.formatNummer('RE-{JAHR}-{NR:04}', 2026, 7), 'RE-2026-0007', 'NR:04');
  eq(Ausgangsrechnung.formatNummer('{JAHR}/{NR}', 2026, 100), '2026/100', 'NR ohne Pad');
  eq(Ausgangsrechnung.formatNummer('R-{NR:06}', 2026, 42), 'R-000042', 'NR:06');
});

test('Ausgangsrechnung: vergebeNummer ist lückenlos und springt am Jahreswechsel', function () {
  var u = { rechnungsnummern: { schema: 'RE-{JAHR}-{NR:04}', naechste: 1, jahr: 0 } };
  eq(Ausgangsrechnung.vergebeNummer(u, '2026-05-20'), 'RE-2026-0001', 'erste 2026');
  eq(Ausgangsrechnung.vergebeNummer(u, '2026-06-01'), 'RE-2026-0002', 'zweite 2026');
  eq(Ausgangsrechnung.vergebeNummer(u, '2026-12-31'), 'RE-2026-0003', 'dritte 2026');
  eq(Ausgangsrechnung.vergebeNummer(u, '2027-01-02'), 'RE-2027-0001', 'reset bei Jahreswechsel');
  eq(u.rechnungsnummern.naechste, 2, 'Zähler steht auf 2');
  eq(u.rechnungsnummern.jahr, 2027, 'Jahr aktualisiert');
});

test('Ausgangsrechnung: naechsteNummer mutiert nicht (Vorschau)', function () {
  var u = { rechnungsnummern: { schema: 'RE-{JAHR}-{NR:04}', naechste: 5, jahr: 2026 } };
  eq(Ausgangsrechnung.naechsteNummer(u, '2026-05-20'), 'RE-2026-0005', 'Vorschau 5');
  eq(Ausgangsrechnung.naechsteNummer(u, '2026-05-20'), 'RE-2026-0005', 'noch immer 5 (keine Mutation)');
  eq(u.rechnungsnummern.naechste, 5, 'Zähler unverändert');
});

test('Ausgangsrechnung: eigeneAusUnternehmen — rechnungsAngaben überschreibt Hauptfelder', function () {
  var u = { name: 'Haupt-GmbH', strasse: 'Haupt 1', plz: '11111', ort: 'X',
    steuernummer: '111/111/11111',
    rechnungsAngaben: { name: 'Rechnungs-Name GmbH', ustId: 'DE999999999' } };
  var e = Ausgangsrechnung.eigeneAusUnternehmen(u);
  eq(e.name, 'Rechnungs-Name GmbH', 'Override gewinnt');
  eq(e.strasse, 'Haupt 1', 'Fallback auf Hauptdaten');
  eq(e.ustId, 'DE999999999', 'USt-ID aus rechnungsAngaben');
  eq(e.stNr, '111/111/11111', 'Steuernummer-Fallback');
});

test('Ausgangsrechnung: defaults — kunden und rechnungsnummern werden angelegt', function () {
  var u = { name: 'X' };
  var d = Ausgangsrechnung.defaults(u);
  ok(Array.isArray(d.kunden), 'kunden[] existiert');
  ok(d.rechnungsnummern && d.rechnungsnummern.schema, 'rechnungsnummern existiert');
});

test('Ausgangsrechnung: Buchungssatz NORMAL 19% — Forderung an Erlös + USt', function () {
  var r = { nummer: 'RE-2026-0001', datum: '2026-05-20', besonderheit: 'NORMAL',
    kundeSnapshot: { name: 'Kunde KG' },
    positionen: [{ bezeichnung: 'X', menge: 1, einheit: 'C62', einzelpreis: 100, ustSatz: 19 }] };
  var bu = Ausgangsrechnung.buchungenAusRechnung(r, 'TS');
  eq(bu.length, 2, 'zwei Buchungen');
  eq(bu[0].soll, '1200', 'Forderung');
  eq(bu[0].haben, '4400', 'Erlöse 19%');
  eq(bu[0].betrag, 100, 'Netto');
  eq(bu[1].soll, '1200', 'Forderung (USt)');
  eq(bu[1].haben, '3806', 'USt 19%');
  eq(bu[1].betrag, 19, 'USt-Betrag');
});

test('Ausgangsrechnung: Buchungssatz §13b — Forderung an Erlöse §13b, kein USt-Buchungssatz', function () {
  var r = { nummer: 'RE-2026-0002', datum: '2026-05-20', besonderheit: 'REVERSE_CHARGE_13b',
    kundeSnapshot: { name: 'Kunde KG' },
    positionen: [{ bezeichnung: 'X', menge: 1, einheit: 'C62', einzelpreis: 100, ustSatz: 19 }] };
  var bu = Ausgangsrechnung.buchungenAusRechnung(r, 'TS');
  eq(bu.length, 1, 'eine Buchung, keine USt');
  eq(bu[0].soll, '1200', 'Forderung');
  eq(bu[0].haben, '4336', 'Erlöse §13b');
  eq(bu[0].betrag, 100, 'Netto = Brutto');
});

test('Ausgangsrechnung: Buchungssatz §19 Kleinunternehmer — keine USt-Trennung', function () {
  var r = { nummer: 'RE-2026-0003', datum: '2026-05-20', besonderheit: 'KLEINUNTERNEHMER_19',
    kundeSnapshot: { name: 'Kunde KG' },
    positionen: [{ bezeichnung: 'X', menge: 2, einheit: 'C62', einzelpreis: 50, ustSatz: 19 }] };
  var bu = Ausgangsrechnung.buchungenAusRechnung(r, 'TS');
  eq(bu.length, 1, 'eine Buchung');
  eq(bu[0].betrag, 100, 'Volle Summe als Erlös');
  eq(bu[0].haben, '4400', 'Erlöse-Konto');
});

test('Ausgangsrechnung: Buchungssatz Mix 19/7 — getrennte Buchungen pro Satz', function () {
  var r = { nummer: 'RE-2026-0004', datum: '2026-05-20', besonderheit: 'NORMAL',
    kundeSnapshot: { name: 'Kunde KG' },
    positionen: [
      { bezeichnung: 'A', menge: 1, einheit: 'C62', einzelpreis: 100, ustSatz: 19 },
      { bezeichnung: 'B', menge: 1, einheit: 'C62', einzelpreis: 50,  ustSatz: 7 }
    ] };
  var bu = Ausgangsrechnung.buchungenAusRechnung(r, 'TS');
  eq(bu.length, 4, 'zwei Sätze × (Erlös + USt)');
  var konten = bu.map(function (b) { return b.haben; }).sort();
  eq(konten[0], '3801', 'USt 7%');
  eq(konten[1], '3806', 'USt 19%');
  eq(konten[2], '4300', 'Erlös 7%');
  eq(konten[3], '4400', 'Erlös 19%');
});

/* ---- XRechnung-CII (zweite Syntax: UN/CEFACT) ------------------------ */
test('XRechnung-CII: rendert CrossIndustryInvoice mit Guideline-ID', function () {
  var xml = XRechnungCII.render(basisRechnung(), EIGENE_TEST);
  ok(/<rsm:CrossIndustryInvoice/.test(xml), 'Root-Element');
  ok(/<ram:ID>urn:cen\.eu:en16931:2017#conformant#urn:xoev-de:kosit:standard:xrechnung_3\.0<\/ram:ID>/.test(xml),
     'Guideline-ID auf XRechnung 3.0');
  ok(/<ram:TypeCode>380<\/ram:TypeCode>/.test(xml), 'TypeCode 380');
});

test('XRechnung-CII: Roundtrip via parseERechnung ergibt identische Werte', function () {
  var xml = XRechnungCII.render(basisRechnung(), EIGENE_TEST);
  var rt = Importe.parseERechnung(xml).rechnung;
  eq(rt.nummer, 'RE-2026-0001', 'Nummer');
  eq(rt.netto, 1969.99, 'Netto');
  eq(rt.ust, 374.30, 'USt');
  eq(rt.brutto, 2344.29, 'Brutto');
  eq(rt.verkaeufer, 'Lindgrün Software GmbH', 'Verkäufer mit Umlaut');
  ok(/XRechnung 3/.test(rt.profil), 'Profil erkannt');
  eq(rt.positionen.length, 2, 'zwei Positionen');
  eq(rt.warnungen.length, 0, 'keine Plausi-Warnungen');
});

test('XRechnung-CII: Reverse-Charge — CategoryCode AE und ExemptionReason', function () {
  var r = basisRechnung(); r.besonderheit = 'REVERSE_CHARGE_13b';
  var xml = XRechnungCII.render(r, EIGENE_TEST);
  ok(/<ram:CategoryCode>AE<\/ram:CategoryCode>/.test(xml), 'CategoryCode AE');
  ok(/<ram:ExemptionReason>[^<]*§\s*13b[^<]*<\/ram:ExemptionReason>/.test(xml),
     'ExemptionReason mit §13b');
  var rt = Importe.parseERechnung(xml).rechnung;
  eq(rt.ust, 0, 'USt 0 im Roundtrip');
});

test('XRechnung-CII: SEPA-PaymentMeans + IBAN ohne Leerzeichen', function () {
  var xml = XRechnungCII.render(basisRechnung(), EIGENE_TEST);
  ok(/<ram:TypeCode>58<\/ram:TypeCode>/.test(xml), 'SEPA-PaymentMeans Code 58');
  ok(/<ram:IBANID>DE89370400440532013000<\/ram:IBANID>/.test(xml), 'IBAN inline');
});

test('XRechnung-CII: USt-IdNr. des Verkäufers als TaxRegistration schemeID=VA', function () {
  var xml = XRechnungCII.render(basisRechnung(), EIGENE_TEST);
  ok(/schemeID="VA">DE298765432</.test(xml), 'Eigene USt-ID mit schemeID');
});

test('XRechnung-CII: Datum ISO → CII-102-Format YYYYMMDD', function () {
  var xml = XRechnungCII.render(basisRechnung(), EIGENE_TEST);
  ok(/format="102">20260520</.test(xml), 'IssueDateTime im 102-Format');
  ok(/format="102">20260519</.test(xml), 'Leistungsdatum im 102-Format');
});

/* ---- USt-ID-Strukturprüfung ------------------------------------------ */
test('UstId: DE — ISO 7064 MOD 11-10 erkennt valide Nummer', function () {
  eq(UstId.pruefe('DE123456788').ok, true, 'konstruiertes valides Beispiel');
  eq(UstId.pruefe('DE811569869').ok, true, 'echte USt-IdNr. Telekom DE');
  eq(UstId.pruefe('DE123456789').ok, false, 'Prüfziffer falsch');
  eq(UstId.pruefe('DE12345678').ok, false, 'zu kurz');
});

test('UstId: AT — Luhn-Variante erkennt ATU13585627', function () {
  eq(UstId.pruefe('ATU13585627').ok, true, 'ATU13585627 valide');
  eq(UstId.pruefe('ATU13585621').ok, false, 'Prüfziffer falsch');
});

test('UstId: NL — Mod-11 erkennt 9-Ziffern-Form mit B + 2-stelligem Suffix', function () {
  eq(UstId.pruefe('NL100000009B01').ok, true, 'konstruiertes valides Beispiel');
  eq(UstId.pruefe('NL100000008B01').ok, false, 'Prüfziffer falsch');
  eq(UstId.pruefe('NL100000009').ok, false, 'fehlendes B-Suffix');
});

test('UstId: IT — Luhn-Algorithmus auf 11 Ziffern', function () {
  eq(UstId.pruefe('IT12345678903').ok, true, '11-stellig, Luhn-konform');
  eq(UstId.pruefe('IT12345678904').ok, false, 'Luhn-falsch');
});

test('UstId: nicht implementierte Länder bestehen Format-Check mit Hinweis', function () {
  var r = UstId.pruefe('FR12345678901');
  eq(r.ok, true, 'Format ok');
  ok(/nicht implementiert/.test(r.hinweis), 'Hinweis auf fehlende Prüfziffer');
});

test('UstId: normalisiert Leerzeichen und Großschreibung', function () {
  var r = UstId.pruefe('  de 123 456 788  ');
  eq(r.normalisiert, 'DE123456788', 'Whitespace entfernt + upcase');
  eq(r.ok, true, 'valide nach Normalisierung');
});

test('UstId: unbekannter Länderpräfix → klarer Fehler', function () {
  var r = UstId.pruefe('XYZ123');
  eq(r.ok, false, 'nicht ok');
  ok(/Unbekannter Länderpräfix/.test(r.fehler), 'klare Meldung');
});

test('UstId: leerer Eingabewert → Fehler', function () {
  eq(UstId.pruefe('').ok, false, '');
  eq(UstId.pruefe(null).ok, false, '');
});

/* ---- Fremdwährung § 256a HGB ---------------------------------------- */
test('Fx: kurzfristige Forderung folgt zwingend dem Stichtagskurs', function () {
  // 10.000 USD-Forderung, Anschaffung zu Kurs 1,10 = 11.000 EUR Buchwert,
  // Stichtagskurs 1,15 (USD stärker geworden, EUR-Forderung steigt).
  var r = Fx.stichtagsbewertung({ art: 'vermoegen', buchwertEur: 11000,
    fwBetrag: 10000, kursStichtag: 1.15, restlaufzeitMonate: 6 });
  eq(r.stichtagswertEur, 11500, 'Stichtagswert');
  eq(r.delta, 500, 'Ertrag aus Aufwertung kurzfristiger Forderung');
  eq(r.regel, 'kurzfristig', 'Regel');
});
test('Fx: kurzfristige Forderung wird auch abgewertet (Realisations- aufgehoben)', function () {
  var r = Fx.stichtagsbewertung({ art: 'vermoegen', buchwertEur: 11000,
    fwBetrag: 10000, kursStichtag: 1.05, restlaufzeitMonate: 6 });
  eq(r.stichtagswertEur, 10500, 'Stichtagswert kurzfristig zwingend');
  eq(r.delta, -500, 'Aufwand bei kurzfristiger Abwertung');
});
test('Fx: langfristige Forderung folgt Niederstwertprinzip', function () {
  // Aufwertung wird NICHT vorgenommen (Realisations-/Niederstwert)
  var auf = Fx.stichtagsbewertung({ art: 'vermoegen', buchwertEur: 11000,
    fwBetrag: 10000, kursStichtag: 1.15, restlaufzeitMonate: 36 });
  eq(auf.delta, 0, 'keine Aufwertung über Buchwert');
  eq(auf.regel, 'unveraendert', '');
  // Abwertung wird zwingend vorgenommen
  var ab = Fx.stichtagsbewertung({ art: 'vermoegen', buchwertEur: 11000,
    fwBetrag: 10000, kursStichtag: 1.05, restlaufzeitMonate: 36 });
  eq(ab.delta, -500, 'Abwertung bei Niederstwert');
  eq(ab.regel, 'langfristig-niederstwert', '');
});
test('Fx: langfristige Verbindlichkeit folgt Höchstwertprinzip', function () {
  // Schuld 10.000 USD, Buchwert 11.000, Stichtagskurs 1,15 -> Schuld steigt
  var hoch = Fx.stichtagsbewertung({ art: 'schulden', buchwertEur: 11000,
    fwBetrag: 10000, kursStichtag: 1.15, restlaufzeitMonate: 36 });
  eq(hoch.stichtagswertEur, 11500, 'Schuld zum höheren Stichtagswert');
  eq(hoch.delta, 500, 'Anstieg der Schuld');
  eq(hoch.guvWirkung, -500, 'GuV-Wirkung Aufwand bei Schulden-Aufwertung');
  // Schuld fällt -> Buchwert bleibt, kein Ertrag
  var stab = Fx.stichtagsbewertung({ art: 'schulden', buchwertEur: 11000,
    fwBetrag: 10000, kursStichtag: 1.05, restlaufzeitMonate: 36 });
  eq(stab.delta, 0, 'keine Abwertung der Schuld');
  eq(stab.regel, 'unveraendert', '');
});

/* ---- Command-Palette: Fuzzy-Suche ----------------------------------- */
test('Palette: fuzzy findet Subsequence', function () {
  ok(Palette.fuzzy('ust', 'umsatzsteuer') >= 0, 'ust in umsatzsteuer');
  ok(Palette.fuzzy('uts', 'umsatzsteuer') >= 0, 'uts findet u-m-saTzSteuer');
  eq(Palette.fuzzy('xyz', 'umsatzsteuer'), -1, 'xyz hat keinen Match');
  eq(Palette.fuzzy('', 'egal'), 0, 'leere Query = Score 0');
});
test('Palette: kompakter Treffer hat niedrigeren Score als verstreuter', function () {
  // "ust" lückenlos am Anfang besser als "u_t" weit auseinander
  var direkt = Palette.fuzzy('ust', 'ustva');
  var verstreut = Palette.fuzzy('ust', 'umsatzsteuer');
  ok(direkt < verstreut, 'direkt < verstreut');
});
test('Palette: suche filtert und sortiert nach Score', function () {
  var ein = [
    { label: 'Glossar' },
    { label: 'Buchhaltung' },
    { label: 'Buchungsvorlagen' },
    { label: 'Anlagenverzeichnis' }
  ];
  var r = Palette.suche(ein, 'buch');
  eq(r.length, 2, 'nur die zwei Buch-Treffer');
  ok(/Buch/.test(r[0].label), 'erster Treffer beginnt mit Buch');
});
test('Palette: leere Query liefert alphabetisch sortierte Liste', function () {
  var ein = [
    { label: 'Zentral' }, { label: 'Anlagen' }, { label: 'Mitte' }
  ];
  var r = Palette.suche(ein, '');
  eq(r[0].label, 'Anlagen', 'Anlagen zuerst');
  eq(r[2].label, 'Zentral', 'Zentral zuletzt');
});
test('Palette: Sub-Feld wird ebenfalls durchsucht, Label-Treffer bevorzugt', function () {
  var ein = [
    { label: 'Steuer', sub: 'KSt, GewSt' },
    { label: 'GoBD',   sub: 'Steuerrückstellung Hinweise' }
  ];
  var r = Palette.suche(ein, 'steuer');
  eq(r[0].label, 'Steuer', 'Label-Treffer Steuer zuerst');
});

/* ---- Buchungsvorlagen ------------------------------------------------ */
test('Vorlagen: pruefe akzeptiert vollstaendige Vorlage', function () {
  var v = { name: 'Adobe', text: 'Adobe CC', soll: '6805', haben: '1800', betrag: 71.99 };
  eq(Vorlagen.pruefe(v).ok, true, 'gueltig');
});
test('Vorlagen: pruefe verlangt Name, Soll, Haben', function () {
  ok(!Vorlagen.pruefe({ soll: '6805', haben: '1800' }).ok, 'ohne Name');
  ok(!Vorlagen.pruefe({ name: 'X', haben: '1800' }).ok, 'ohne Soll');
  ok(!Vorlagen.pruefe({ name: 'X', soll: '6805' }).ok, 'ohne Haben');
});
test('Vorlagen: gleiches Soll und Haben wird abgelehnt', function () {
  var r = Vorlagen.pruefe({ name: 'X', soll: '1800', haben: '1800' });
  eq(r.ok, false, 'soll = haben');
});
test('Vorlagen: anwenden uebertraegt Felder mit Datum', function () {
  var v = { name: 'Adobe', text: 'Adobe CC', soll: '6805', haben: '1800', betrag: 71.99 };
  var b = Vorlagen.anwenden(v, '2026-05-20');
  eq(b.datum, '2026-05-20', 'datum');
  eq(b.soll, '6805', 'soll');
  eq(b.haben, '1800', 'haben');
  eq(b.text, 'Adobe CC', 'text');
  eq(b.betrag, 71.99, 'betrag');
});
test('Vorlagen: sortiert alphabetisch nach Name', function () {
  var l = [{ name: 'Zebra' }, { name: 'Adobe' }, { name: 'Microsoft' }];
  var s = Vorlagen.sortiert(l);
  eq(s[0].name, 'Adobe', 'A zuerst');
  eq(s[2].name, 'Zebra', 'Z zuletzt');
});
test('Vorlagen: naechsteFaelligkeit folgt dem Takt', function () {
  var v = { name: 'X', soll: '6805', haben: '1800',
    wiederkehrend: { takt: 'monatlich', letzteAusfuehrung: '2026-04-15' } };
  eq(Vorlagen.naechsteFaelligkeit(v), '2026-05-15', 'monatlich');
  v.wiederkehrend.takt = 'quartalsweise';
  eq(Vorlagen.naechsteFaelligkeit(v), '2026-07-15', 'quartalsweise');
  v.wiederkehrend.takt = 'jaehrlich';
  eq(Vorlagen.naechsteFaelligkeit(v), '2027-04-15', 'jährlich');
});
test('Vorlagen: istFaellig vergleicht naechsten Termin mit heute', function () {
  var v = { name: 'X', soll: '6805', haben: '1800',
    wiederkehrend: { takt: 'monatlich', letzteAusfuehrung: '2026-04-15' } };
  ok(!Vorlagen.istFaellig(v, '2026-05-01'), 'vor Termin: nicht fällig');
  ok(Vorlagen.istFaellig(v, '2026-05-15'), 'am Termin: fällig');
  ok(Vorlagen.istFaellig(v, '2026-06-30'), 'nach Termin: fällig');
});
test('Vorlagen: ohne wiederkehrend-Flag nicht fällig', function () {
  ok(!Vorlagen.istFaellig({ name: 'X' }, '2026-05-20'), 'keine Wiederholung');
});
test('Vorlagen: ohne letzteAusfuehrung sofort fällig (Erstaufruf)', function () {
  var v = { name: 'X', wiederkehrend: { takt: 'monatlich' } };
  ok(Vorlagen.istFaellig(v, '2026-05-20'), 'erstmalige Fälligkeit');
});
test('Vorlagen: faellige filtert nur den fälligen Teil', function () {
  var liste = [
    { name: 'A', wiederkehrend: { takt: 'monatlich', letzteAusfuehrung: '2026-04-01' } },
    { name: 'B', wiederkehrend: { takt: 'monatlich', letzteAusfuehrung: '2026-05-10' } },
    { name: 'C' }
  ];
  var r = Vorlagen.faellige(liste, '2026-05-15');
  eq(r.length, 1, 'nur A fällig');
  eq(r[0].vorlage.name, 'A', '');
});
test('Vorlagen: markiereAusgefuehrt setzt letzteAusfuehrung', function () {
  var v = { name: 'X', wiederkehrend: { takt: 'monatlich' } };
  Vorlagen.markiereAusgefuehrt(v, '2026-05-20');
  eq(v.wiederkehrend.letzteAusfuehrung, '2026-05-20', '');
});

/* ---- Belegnummern: Lueckenanalyse Nummernkreis (§ 14 UStG) ---------- */
test('Belegnummern: parse zerlegt Reihe und laufende Nummer', function () {
  var p = Belegnummern.parse('RE-2026-0042');
  eq(p.reihe, 'RE-2026-', 'reihe');
  eq(p.nummer, 42, 'nummer');
  eq(p.breite, 4, 'breite');
  eq(p.suffix, '', 'suffix');
});
test('Belegnummern: parse nimmt die LETZTE Ziffernfolge als Nummer', function () {
  var p = Belegnummern.parse('2026-1');
  eq(p.reihe, '2026-', 'Jahr bleibt in der Reihe');
  eq(p.nummer, 1, 'nummer');
});
test('Belegnummern: parse ohne Ziffer liefert null', function () {
  eq(Belegnummern.parse('ABC'), null, 'keine Ziffer');
  eq(Belegnummern.parse(''), null, 'leer');
  eq(Belegnummern.parse(null), null, 'null');
});
test('Belegnummern: lueckenlose Reihe ist ok', function () {
  var r = Belegnummern.analysiere(['RE-2026-0001', 'RE-2026-0002', 'RE-2026-0003']);
  ok(r.ok, 'ok');
  eq(r.luecken.length, 0, 'keine Luecken');
  eq(r.reihen.length, 1, 'eine Reihe');
  ok(r.reihen[0].vollstaendig, 'vollstaendig');
  eq(r.reihen[0].von, 1, 'von');
  eq(r.reihen[0].bis, 3, 'bis');
});
test('Belegnummern: erkennt eine fehlende Nummer', function () {
  var r = Belegnummern.analysiere(['RE-2026-0001', 'RE-2026-0002', 'RE-2026-0004']);
  ok(!r.ok, 'nicht ok');
  eq(r.luecken.length, 1, 'eine Luecke');
  eq(r.luecken[0], 'RE-2026-0003', 'fehlt formatiert mit fuehrender Null');
  eq(r.reihen[0].lueckenAnzahl, 1, 'lueckenAnzahl');
});
test('Belegnummern: Jahreswechsel ergibt zwei eigenstaendige Reihen', function () {
  var r = Belegnummern.analysiere([
    'RE-2025-0001', 'RE-2025-0002',
    'RE-2026-0001', 'RE-2026-0002'
  ]);
  eq(r.reihen.length, 2, 'zwei Reihen');
  ok(r.ok, 'beide lueckenlos => ok');
});
test('Belegnummern: Dublette wird gemeldet', function () {
  var r = Belegnummern.analysiere(['RE-2026-0001', 'RE-2026-0002', 'RE-2026-0002']);
  eq(r.dubletten.length, 1, 'eine Dublette');
  eq(r.dubletten[0], 'RE-2026-0002', '');
  ok(!r.ok, 'Dublette => nicht ok');
});
test('Belegnummern: nicht parsbare Nummern landen in unparsbar', function () {
  var r = Belegnummern.analysiere(['RE-2026-0001', 'ENTWURF', '']);
  eq(r.unparsbar.length, 1, 'nur ENTWURF unparsbar (leer ignoriert)');
  eq(r.unparsbar[0], 'ENTWURF', '');
});
test('Belegnummern: einzelne Nummer hat keine Luecke', function () {
  var r = Belegnummern.analysiere(['RE-2026-0005']);
  ok(r.ok, 'ok');
  eq(r.reihen[0].von, 5, 'von == bis');
  eq(r.reihen[0].bis, 5, '');
});
test('Belegnummern: riesige Luecke wird gekuerzt, Anzahl bleibt exakt', function () {
  var r = Belegnummern.analysiere(['A-1', 'A-5000']);
  eq(r.reihen[0].lueckenAnzahl, 4998, 'exakte Lueckenzahl 2..4999');
  ok(r.reihen[0].gekuerzt, 'gekuerzt-Flag gesetzt');
  ok(r.reihen[0].luecken.length <= Belegnummern.MAX_LUECKEN, 'Liste gedeckelt');
});

/* ---- Sicherheit: Pfad-Traversal-Schutz in store.sicher() ----------- */
test('store.sicher: reine Punkt-Segmente (.., ., ...) werden auf STANDARD entschärft', function () {
  eq(Store.sicher('..'), Store.STANDARD, 'mandant=.. darf nicht aus dem Verzeichnis ausbrechen');
  eq(Store.sicher('.'), Store.STANDARD, '. (aktuelles Verzeichnis) entschärft');
  eq(Store.sicher('...'), Store.STANDARD, '... entschärft');
  eq(Store.sicher(''), Store.STANDARD, 'leer -> STANDARD');
  eq(Store.sicher(null), Store.STANDARD, 'null -> STANDARD');
});
test('store.sicher: Slashes/Sonderzeichen werden zu _, legitime Punkte bleiben', function () {
  ok(Store.sicher('m/x').indexOf('/') < 0, 'kein Slash im Ergebnis');
  ok(Store.sicher('../etc') !== '..', 'Traversal-Versuch ist kein reines ..');
  ok(Store.sicher('../etc').indexOf('/') < 0, 'kein Slash im Traversal-Versuch');
  eq(Store.sicher('v2.0'), 'v2.0', 'Punkt innerhalb eines Namens bleibt erhalten');
  eq(Store.sicher('A-123'), 'A-123', 'normale ID unverändert');
});

/* ---- Mandanten-Migration (Welle 7, Schritt a) ---------------------- */
var MM_JETZT = { jetzt: '2026-06-05T00:00:00.000Z' };
test('MandantenMigration: v1 -> v2 ordnet alles Mandant standard zu', function () {
  var alt = {
    unternehmen: { name: 'Lindgruen GmbH', ort: 'Leipzig' },
    abschluesse: [{ id: 'A1', stichtag: '2024-12-31' }, { id: 'A2', stichtag: '2023-12-31' }]
  };
  var v2 = MandantenMigration.migriere(alt, MM_JETZT);
  eq(v2.version, 2, 'version 2');
  eq(v2.mandanten.length, 1, 'ein Mandant');
  eq(v2.mandanten[0].id, 'standard', 'id standard');
  eq(v2.mandanten[0].name, 'Lindgruen GmbH', 'Name aus Unternehmen');
  eq(v2.mandanten[0].angelegtAm, '2026-06-05T00:00:00.000Z', 'jetzt injiziert');
  eq(v2.unternehmen.length, 1, 'ein Unternehmen');
  eq(v2.unternehmen[0].mandantId, 'standard', 'Unternehmen mandantId');
  eq(v2.unternehmen[0].ort, 'Leipzig', 'Unternehmensdaten erhalten');
  eq(v2.abschluesse.length, 2, 'beide Abschluesse erhalten');
  ok(v2.abschluesse.every(function (a) { return a.mandantId === 'standard'; }), 'alle mandantId');
});
test('MandantenMigration: verlustfrei (id-Menge identisch)', function () {
  var alt = { unternehmen: { name: 'X' },
    abschluesse: [{ id: 'A1' }, { id: 'A2' }, { id: 'A3' }] };
  var v2 = MandantenMigration.migriere(alt, MM_JETZT);
  var ids = v2.abschluesse.map(function (a) { return a.id; }).sort().join(',');
  eq(ids, 'A1,A2,A3', 'keine Abschluss-id verloren oder dazuerfunden');
});
test('MandantenMigration: idempotent (zweimal == einmal)', function () {
  var alt = { unternehmen: { name: 'X' }, abschluesse: [{ id: 'A1', stichtag: '2024-12-31' }] };
  var einmal = MandantenMigration.migriere(alt, MM_JETZT);
  var zweimal = MandantenMigration.migriere(einmal, MM_JETZT);
  eq(JSON.stringify(zweimal), JSON.stringify(einmal), 'zweite Migration aendert nichts');
  eq(zweimal.mandanten.length, 1, 'Mandant nicht verdoppelt');
});
test('MandantenMigration: bereits migrierter Stand bleibt unveraendert', function () {
  var v2 = { version: 2, mandanten: [{ id: 'standard', name: 'A', angelegtAm: 't' }],
    unternehmen: [{ mandantId: 'standard', name: 'A' }],
    abschluesse: [{ id: 'A1', mandantId: 'standard' }] };
  ok(MandantenMigration.istMigriert(v2), 'als migriert erkannt');
  var r = MandantenMigration.migriere(v2, MM_JETZT);
  eq(r.mandanten.length, 1, 'nicht verdoppelt');
  eq(r.abschluesse[0].mandantId, 'standard', 'mandantId erhalten');
});
test('MandantenMigration: fresh install (keine Daten) ohne Phantom-Mandant', function () {
  var leer = MandantenMigration.migriere({ unternehmen: null, abschluesse: [] }, MM_JETZT);
  eq(leer.mandanten.length, 0, 'kein Phantom-Mandant');
  eq(leer.abschluesse.length, 0, '');
  var nullArg = MandantenMigration.migriere(null, MM_JETZT);
  eq(nullArg.mandanten.length, 0, 'null-Eingabe robust');
});
test('MandantenMigration: Abschluesse ohne Unternehmen -> Name Fallback Standard', function () {
  var v2 = MandantenMigration.migriere({ unternehmen: null, abschluesse: [{ id: 'A1' }] }, MM_JETZT);
  eq(v2.mandanten.length, 1, 'Mandant fuer verwaiste Abschluesse');
  eq(v2.mandanten[0].name, 'Standard', 'Fallback-Name');
  eq(v2.unternehmen.length, 0, 'kein Unternehmen');
  eq(v2.abschluesse[0].mandantId, 'standard', 'Abschluss zugeordnet');
});
test('MandantenMigration: vorhandene fremde mandantId wird NICHT ueberschrieben', function () {
  var teil = { unternehmen: null, abschluesse: [{ id: 'A1', mandantId: 'kunde-b' }] };
  var r = MandantenMigration.migriere(teil, MM_JETZT);
  eq(r.abschluesse[0].mandantId, 'kunde-b', 'fremde mandantId bleibt (kein Clobber auf standard)');
  ok(r.mandanten.some(function (m) { return m.id === 'kunde-b'; }),
     'Mandant fuer fremde id angelegt (nicht verwaist)');
});
test('MandantenMigration: EDGE1 - abgebrochener Lauf wird vervollstaendigt', function () {
  // Crash mittendrin: A1 hat schon mandantId, A2 noch nicht, mandanten[] fehlt.
  var partiell = { abschluesse: [{ id: 'A1', mandantId: 'standard' }, { id: 'A2' }] };
  var r = MandantenMigration.migriere(partiell, MM_JETZT);
  eq(r.abschluesse.length, 2, 'beide Abschluesse erhalten (kein Verlust)');
  ok(r.abschluesse.every(function (a) { return a.mandantId === 'standard'; }),
     'A2 wird nachgezogen statt verwaist');
  eq(r.mandanten.length, 1, 'Mandant standard angelegt');
  ok(MandantenMigration.istMigriert(r), 'Ergebnis ist vollstaendig migriert');
});
test('MandantenMigration: partiell migriert gilt NICHT als istMigriert', function () {
  ok(!MandantenMigration.istMigriert({
    mandanten: [{ id: 'standard' }],
    abschluesse: [{ id: 'A1', mandantId: 'standard' }, { id: 'A2' }]
  }), 'ein Satz ohne mandantId => nicht vollstaendig');
});
test('MandantenMigration: tiefe Kopie - Original bleibt unangetastet', function () {
  var alt = { unternehmen: { name: 'X' }, abschluesse: [{ id: 'A1' }] };
  MandantenMigration.migriere(alt, MM_JETZT);
  ok(!('mandantId' in alt.abschluesse[0]), 'Original-Abschluss nicht mutiert');
  ok(!('mandantId' in alt.unternehmen), 'Original-Unternehmen nicht mutiert');
});

/* ---- Server-Dateilayout-Migration (Welle 7, Schritt a/3) ----------- */
var StoreMig = require('../lib/mandanten-store-migration.js');
(function () {
  var sfs = require('fs'), sos = require('os'), spath = require('path');
  var SMIG = { ts: '2026-06-06T00-00-00', jetzt: '2026-06-06T00:00:00.000Z' };
  function tmpBase() { return sfs.mkdtempSync(spath.join(sos.tmpdir(), 'obz-mig-')); }
  function altLayout(base, withUnt, ids) {
    if (withUnt) sfs.writeFileSync(spath.join(base, 'unternehmen.json'),
      JSON.stringify({ name: 'Lindgruen GmbH', ort: 'Leipzig' }));
    var ad = spath.join(base, 'abschluesse'); sfs.mkdirSync(ad, { recursive: true });
    (ids || []).forEach(function (id) {
      sfs.writeFileSync(spath.join(ad, id + '.json'),
        JSON.stringify({ id: id, stichtag: '2024-12-31' }));
    });
  }
  function weg(b) { sfs.rmSync(b, { recursive: true, force: true }); }

  test('StoreMig: altes Layout wird erkannt', function () {
    var b = tmpBase(); altLayout(b, true, ['A1']);
    ok(StoreMig.istAltesLayout(b), 'erkannt');
    weg(b);
  });
  test('StoreMig: migriert verlustfrei, Pre-Backup, Originale bleiben', function () {
    var b = tmpBase(); altLayout(b, true, ['A1', 'A2']);
    var r = StoreMig.migriereDateiLayout(b, SMIG);
    ok(r.migriert, 'migriert');
    eq(r.anzahlAbschluesse, 2, 'beide Abschluesse');
    ok(sfs.existsSync(spath.join(b, 'mandanten', 'standard', 'unternehmen.json')), 'unternehmen im Ziel');
    ok(sfs.existsSync(spath.join(b, 'mandanten', 'standard', 'abschluesse', 'A1.json')), 'A1 im Ziel');
    ok(sfs.existsSync(spath.join(b, 'mandanten', 'standard', 'abschluesse', 'A2.json')), 'A2 im Ziel');
    var idx = JSON.parse(sfs.readFileSync(spath.join(b, 'mandanten.json'), 'utf8'));
    eq(idx.length, 1, 'ein Mandant'); eq(idx[0].id, 'standard', 'id'); eq(idx[0].name, 'Lindgruen GmbH', 'Name');
    ok(sfs.existsSync(spath.join(r.backupDir, 'abschluesse', 'A1.json')), 'Pre-Backup A1');
    ok(sfs.existsSync(spath.join(r.backupDir, 'unternehmen.json')), 'Pre-Backup unternehmen');
    ok(sfs.existsSync(spath.join(b, 'unternehmen.json')), 'Original unternehmen bleibt');
    ok(sfs.existsSync(spath.join(b, 'abschluesse', 'A1.json')), 'Original A1 bleibt');
    weg(b);
  });
  test('StoreMig: Zielinhalt == Quellinhalt (verlustfrei)', function () {
    var b = tmpBase(); altLayout(b, true, ['A1']);
    StoreMig.migriereDateiLayout(b, SMIG);
    var quelle = sfs.readFileSync(spath.join(b, 'abschluesse', 'A1.json'), 'utf8');
    var ziel = sfs.readFileSync(spath.join(b, 'mandanten', 'standard', 'abschluesse', 'A1.json'), 'utf8');
    eq(ziel, quelle, 'Abschluss-Inhalt identisch kopiert');
    weg(b);
  });
  test('StoreMig: idempotent (zweiter Lauf no-op)', function () {
    var b = tmpBase(); altLayout(b, true, ['A1']);
    StoreMig.migriereDateiLayout(b, SMIG);
    var r2 = StoreMig.migriereDateiLayout(b, SMIG);
    ok(!r2.migriert, 'kein zweiter Lauf'); eq(r2.grund, 'bereits-migriert', '');
    weg(b);
  });
  test('StoreMig: keine Altdaten -> kein Lauf', function () {
    var b = tmpBase();
    var r = StoreMig.migriereDateiLayout(b, SMIG);
    ok(!r.migriert, ''); eq(r.grund, 'keine-altdaten', '');
    weg(b);
  });
})();

/* ---- Autocomplete: Konto-Vorschlaege aus Journal -------------------- */
test('Autocomplete: lernt das passende Konto aus drei früheren Buchungen', function () {
  var j = [
    { text: 'Adobe CC',     soll: '6805', haben: '1800' },
    { text: 'Adobe Lizenz', soll: '6805', haben: '1800' },
    { text: 'Adobe Photo',  soll: '6805', haben: '1800' }
  ];
  var v = Autocomplete.vorschlaege('Adobe Cloud', j);
  ok(v.length >= 1, 'mindestens ein Vorschlag');
  eq(v[0].konto, '6805', 'Top-Vorschlag 6805');
});
test('Autocomplete: häufigstes Konto zuerst, alternatives danach', function () {
  var j = [
    { text: 'Telekom DSL', soll: '6805', haben: '1800' },
    { text: 'Telekom DSL', soll: '6805', haben: '1800' },
    { text: 'Telekom Mobilfunk', soll: '6300', haben: '1800' }
  ];
  var v = Autocomplete.vorschlaege('Telekom', j);
  eq(v[0].konto, '6805', '2x 6805 zuerst');
  eq(v[1].konto, '6300', '1x 6300 danach');
});
test('Autocomplete: leerer Text liefert keine Vorschläge', function () {
  var j = [{ text: 'Adobe', soll: '6805', haben: '1800' }];
  eq(Autocomplete.vorschlaege('', j).length, 0, '');
  eq(Autocomplete.vorschlaege('  ', j).length, 0, '');
});
test('Autocomplete: ohne passendes Token kein Vorschlag', function () {
  var j = [{ text: 'Adobe', soll: '6805', haben: '1800' }];
  eq(Autocomplete.vorschlaege('Lufthansa', j).length, 0, '');
});
test('Autocomplete: stornierte Buchungen werden ignoriert', function () {
  var j = [
    { text: 'Adobe', soll: '6805', haben: '1800', storniert: true },
    { text: 'Adobe', soll: '6300', haben: '1800' }
  ];
  var v = Autocomplete.vorschlaege('Adobe', j);
  eq(v.length, 1, 'nur die nicht-stornierte zählt');
  eq(v[0].konto, '6300', '');
});
test('Autocomplete: Haben-Feld separat abfragbar', function () {
  var j = [{ text: 'Lufthansa', soll: '6650', haben: '1800' }];
  var s = Autocomplete.vorschlaege('Lufthansa', j, { feld: 'soll' });
  var h = Autocomplete.vorschlaege('Lufthansa', j, { feld: 'haben' });
  eq(s[0].konto, '6650', '');
  eq(h[0].konto, '1800', '');
});

/* ---- Buchungs-Plausi (vor Aufnahme ins Journal) --------------------- */
test('BuchungsPruefung: gültige Buchung passiert ohne Fehler', function () {
  var r = BuchungsPruefung.pruefe(
    { datum: '2026-03-15', betrag: 100, soll: '6815', haben: '1800' },
    { beginn: '2026-01-01', stichtag: '2026-12-31' });
  eq(r.ok, true, '');
  eq(r.fehler.length, 0, '');
});
test('BuchungsPruefung: Soll = Haben wird abgelehnt', function () {
  var r = BuchungsPruefung.pruefe(
    { datum: '2026-03-15', betrag: 100, soll: '1800', haben: '1800' });
  eq(r.ok, false, '');
});
test('BuchungsPruefung: Aufwand auf Aufwand gibt Warnung', function () {
  var r = BuchungsPruefung.pruefe(
    { datum: '2026-03-15', betrag: 100, soll: '6815', haben: '6300' });
  eq(r.ok, true, 'keine harten Fehler');
  ok(r.warnungen.some(function (w) { return /Aufwand/.test(w); }), '');
});
test('BuchungsPruefung: Datum nach Stichtag warnt', function () {
  var r = BuchungsPruefung.pruefe(
    { datum: '2027-01-10', betrag: 100, soll: '6815', haben: '1800' },
    { beginn: '2026-01-01', stichtag: '2026-12-31' });
  ok(r.warnungen.some(function (w) { return /nach dem Bilanzstichtag/.test(w); }), '');
});
test('BuchungsPruefung: EBK 9000 ohne Erlaubnis warnt', function () {
  var r = BuchungsPruefung.pruefe(
    { datum: '2026-03-15', betrag: 100, soll: '1800', haben: '9000' });
  ok(r.warnungen.some(function (w) { return /9000/.test(w); }), '');
  var r2 = BuchungsPruefung.pruefe(
    { datum: '2026-03-15', betrag: 100, soll: '1800', haben: '9000' },
    { erlaubeEbk: true });
  ok(!r2.warnungen.some(function (w) { return /9000/.test(w); }), 'mit Erlaubnis kein Hinweis');
});

/* ---- Fristen-Dashboard ----------------------------------------------- */
test('Fristen: JA-Aufstellung 6 Monate nach Stichtag', function () {
  var u = {}, abs = [{ id: 'A', art: 'JAHRESABSCHLUSS', stichtag: '2025-12-31',
    bezeichnung: 'Jahresabschluss 2025' }];
  var r = Fristen.naechsteFristen(u, abs, '2026-05-20');
  var auf = r.find(function (x) { return x.art === 'aufstellung'; });
  ok(auf, 'Aufstellungs-Frist gelistet');
  eq(auf.frist, '2026-06-30', 'frist');
  ok(auf.restTage > 0 && auf.restTage <= 45, 'Frist noch knapp da');
  // 41 Tage Rest -> ampel = gruen (Schwelle ist 30)
  eq(auf.ampel, 'gruen', '41 Tage > 30 -> gruen');
  // Direkt am Vortag des 30-Tage-Limits sollte aber gelb sein:
  var r2 = Fristen.naechsteFristen(u, abs, '2026-06-01');
  var auf2 = r2.find(function (x) { return x.art === 'aufstellung'; });
  eq(auf2.ampel, 'gelb', 'innerhalb 30 Tage = gelb');
});
test('Fristen: Offenlegung 12 Monate, verstrichen = rot', function () {
  var u = {}, abs = [{ id: 'A', art: 'JAHRESABSCHLUSS', stichtag: '2024-12-31',
    bezeichnung: 'Jahresabschluss 2024' }];
  var r = Fristen.naechsteFristen(u, abs, '2026-05-20');
  var off = r.find(function (x) { return x.art === 'offenlegung'; });
  eq(off.frist, '2025-12-31', 'frist');
  eq(off.ampel, 'rot', 'Frist verstrichen');
});
test('Fristen: Aufbewahrung 10 Jahre nach Stichtag', function () {
  var u = {}, abs = [{ id: 'A', art: 'JAHRESABSCHLUSS', stichtag: '2024-12-31' }];
  var r = Fristen.naechsteFristen(u, abs, '2026-05-20');
  var auf = r.find(function (x) { return x.art === 'aufbewahrung'; });
  ok(auf, 'Aufbewahrung gelistet');
  eq(auf.frist, '2034-12-31', '');
  eq(auf.ampel, 'gruen', 'noch weit hin');
});
test('Fristen: Buchungsbelege 8 Jahre nach Stichtag (BEG IV)', function () {
  var u = {}, abs = [{ id: 'A', art: 'JAHRESABSCHLUSS', stichtag: '2024-12-31' }];
  var r = Fristen.naechsteFristen(u, abs, '2026-05-20');
  var bel = r.find(function (x) { return x.art === 'aufbewahrung-belege'; });
  ok(bel, 'Buchungsbeleg-Frist gelistet');
  eq(bel.frist, '2032-12-31', '8 Jahre nach Stichtag');
  var abschl = r.find(function (x) { return x.art === 'aufbewahrung'; });
  eq(abschl.frist, '2034-12-31', 'Abschluss-Aufbewahrung bleibt 10 Jahre');
});
test('Fristen: Eröffnungsbilanz hat nur Aufbewahrung', function () {
  var u = {}, abs = [{ id: 'A', art: 'EROEFFNUNGSBILANZ', stichtag: '2020-01-01' }];
  var r = Fristen.naechsteFristen(u, abs, '2026-05-20');
  ok(r.some(function (x) { return x.art === 'aufbewahrung'; }), 'Aufbewahrung da');
  ok(!r.some(function (x) { return x.art === 'aufstellung'; }), 'keine Aufstellung');
  ok(!r.some(function (x) { return x.art === 'offenlegung'; }), 'keine Offenlegung');
});
test('Fristen: UStVA wird gelistet, Kleinunternehmer skip', function () {
  var r = Fristen.naechsteFristen({}, [], '2026-05-20');
  ok(r.some(function (x) { return x.art === 'ustva'; }), 'UStVA gelistet');
  var rk = Fristen.naechsteFristen({ kleinunternehmer: true }, [], '2026-05-20');
  ok(!rk.some(function (x) { return x.art === 'ustva'; }), 'Kleinunternehmer: keine UStVA');
});
test('Fristen: Sortierung rot > gelb > gruen', function () {
  var u = {};
  var abs = [
    { id: 'A', art: 'JAHRESABSCHLUSS', stichtag: '2024-12-31' }, // off=rot
    { id: 'B', art: 'JAHRESABSCHLUSS', stichtag: '2025-12-31' }  // off=gruen, aufstellung=gelb
  ];
  var r = Fristen.naechsteFristen(u, abs, '2026-05-20');
  eq(r[0].ampel, 'rot', 'erstes rot');
  // letzter Eintrag muss grün sein
  eq(r[r.length - 1].ampel, 'gruen', 'letzter gruen');
});

/* ---- Steuerberater-Paket (Store-Only-ZIP) --------------------------- */
test('StbPaket: CRC32 von "Hello" stimmt mit dem Referenzwert überein', function () {
  var bytes = Buffer.from('Hello', 'utf8');
  var arr = new Uint8Array(bytes.length);
  for (var i = 0; i < bytes.length; i++) arr[i] = bytes[i];
  eq(StbPaket.crc32(arr), 0xF7D18982, 'CRC32 Hello = 0xF7D18982');
});
test('StbPaket: ZIP hat Local-Header, Central-Directory und End-Of-Central-Directory', function () {
  var zip = StbPaket.baueZip([{ name: 'hello.txt', content: 'Hello' }]);
  ok(zip.length > 60, 'ZIP nicht leer');
  // Local file header signature PK\x03\x04
  eq(zip[0], 0x50, ''); eq(zip[1], 0x4B, ''); eq(zip[2], 0x03, ''); eq(zip[3], 0x04, '');
  // End of central directory signature am Ende: zip[total-22..total-19] = PK\x05\x06
  var off = zip.length - 22;
  eq(zip[off], 0x50, ''); eq(zip[off + 1], 0x4B, '');
  eq(zip[off + 2], 0x05, ''); eq(zip[off + 3], 0x06, '');
});
test('StbPaket: mehrere Dateien werden korrekt aneinandergereiht', function () {
  var zip = StbPaket.baueZip([
    { name: 'a.txt', content: 'A' },
    { name: 'b.txt', content: 'BBB' },
    { name: 'c.json', content: '{"x":1}' }
  ]);
  ok(zip.length > 150, 'ZIP enthält drei Dateien');
  // EOCD hat 3 Entries
  var off = zip.length - 22;
  var dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  eq(dv.getUint16(off + 8, true), 3, 'three entries on disk');
  eq(dv.getUint16(off + 10, true), 3, 'three entries total');
});
test('StbPaket: leere Liste liefert leeres Uint8Array', function () {
  var zip = StbPaket.baueZip([]);
  eq(zip.length, 0, '');
});

/* ---- Belege (SHA-256-Hash) ------------------------------------------- */
test('Belege: sha256HexSync liefert RFC-Referenzwerte', function () {
  // SHA-256 von "abc" = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
  eq(Belege.sha256HexSync('abc'),
     'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', '');
  // SHA-256 von "" = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  eq(Belege.sha256HexSync(''),
     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '');
});
test('Belege: sha256Hex (Promise) gleiches Ergebnis', function () {
  return Belege.sha256Hex('abc').then(function (h) {
    eq(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', '');
  });
});
test('Belege: formatiereBeleg gibt kompakte Anzeige', function () {
  var s = Belege.formatiereBeleg({ name: 'rechnung.pdf', sha256: '0123456789abcdef0123',
    groesseBytes: 2048 });
  ok(/rechnung\.pdf/.test(s), 'Name');
  ok(/2 KB/.test(s), 'Größe');
  ok(/sha256 012345678/.test(s), 'Hash-Auszug');
});

/* ---- Closing-Checkliste --------------------------------------------- */
test('Closing: ohne Buchungen sind alle offen', function () {
  var a = { art: 'JAHRESABSCHLUSS', buchungen: [], anlagen: [] };
  var l = Closing.pruefeJaReadiness(a);
  ok(l.length >= 5, '>= 5 Pruefpunkte');
  ok(l.find(function (x) { return /Anfangsbestände/.test(x.titel); }).status === 'offen', '');
});
test('Closing: Anfangsbestände erkannt sobald 9000 bebucht', function () {
  var a = { art: 'JAHRESABSCHLUSS', buchungen: [
    { id: '1', soll: '1800', haben: '9000', betrag: 100 }
  ], anlagen: [] };
  var l = Closing.pruefeJaReadiness(a);
  eq(l.find(function (x) { return /Anfangsbestände/.test(x.titel); }).status, 'ok', '');
});
test('Closing: AfA-Hinweis wenn Anlagen vorhanden aber kein AfA-Konto bebucht', function () {
  var a = { art: 'JAHRESABSCHLUSS', buchungen: [], anlagen: [{ name: 'PC' }] };
  var l = Closing.pruefeJaReadiness(a);
  eq(l.find(function (x) { return /AfA/.test(x.titel); }).status, 'offen', '');
});
test('Closing: Steuerrückstellung erkannt', function () {
  var a = { art: 'JAHRESABSCHLUSS', buchungen: [
    { id: '1', soll: '7600', haben: '3040', betrag: 5000 }
  ], anlagen: [] };
  var l = Closing.pruefeJaReadiness(a);
  eq(l.find(function (x) { return /Steuerrückstellungen/.test(x.titel); }).status, 'ok', '');
});
test('Closing: Festschreibung erkennt offene Buchungen', function () {
  var a = { art: 'JAHRESABSCHLUSS', buchungen: [
    { id: '1', soll: '6815', haben: '1800', betrag: 100, fest: true },
    { id: '2', soll: '6815', haben: '1800', betrag: 200 }
  ], anlagen: [] };
  var l = Closing.pruefeJaReadiness(a);
  var p = l.find(function (x) { return /festgeschrieben/.test(x.titel); });
  eq(p.status, 'offen', '');
  ok(/1 von 2/.test(p.detail), '');
});

/* ---- Closing-Checkliste UStVA (§ 18 UStG) --------------------------- */
function findP(liste, re) { return liste.find(function (x) { return re.test(x.titel); }); }
test('UStVA-Readiness: sauberer Monat ist ok', function () {
  var b = [
    { datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 1000, fest: true },
    { datum: '2026-03-10', soll: '1200', haben: '3806', betrag: 190,  fest: true }
  ];
  var u = Ustva.berechne(b, '2026-03-01', '2026-03-31', {});
  var l = Closing.pruefeUstvaReadiness(b, '2026-03-01', '2026-03-31', u);
  eq(findP(l, /festgeschrieben/).status, 'ok', 'alle fest');
  eq(findP(l, /Gebuchte USt/).status, 'ok', 'USt passt');
  eq(findP(l, /Vorsteuer/).status, 'ok', 'Vorsteuer plausibel');
});
test('UStVA-Readiness: USt-Buchung passt nicht zu den Erlösen', function () {
  var b = [
    { datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 1000, fest: true },
    { datum: '2026-03-10', soll: '1200', haben: '3806', betrag: 100,  fest: true } // statt 190
  ];
  var u = Ustva.berechne(b, '2026-03-01', '2026-03-31', {});
  var l = Closing.pruefeUstvaReadiness(b, '2026-03-01', '2026-03-31', u);
  eq(findP(l, /Gebuchte USt/).status, 'offen', 'Differenz erkannt');
});
test('UStVA-Readiness: offene Buchung im Zeitraum wird gemeldet', function () {
  var b = [
    { datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 1000, fest: true },
    { datum: '2026-03-10', soll: '1200', haben: '3806', betrag: 190,  fest: false }
  ];
  var u = Ustva.berechne(b, '2026-03-01', '2026-03-31', {});
  var l = Closing.pruefeUstvaReadiness(b, '2026-03-01', '2026-03-31', u);
  eq(findP(l, /festgeschrieben/).status, 'offen', '1 offen');
  ok(/1 von 2/.test(findP(l, /festgeschrieben/).detail), 'Zählung');
});
test('UStVA-Readiness: Vorsteuerüberhang ergibt Erstattung', function () {
  var b = [
    { datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 1000, fest: true },
    { datum: '2026-03-10', soll: '1200', haben: '3806', betrag: 190,  fest: true },
    { datum: '2026-03-12', soll: '1406', haben: '1600', betrag: 300,  fest: true }
  ];
  var u = Ustva.berechne(b, '2026-03-01', '2026-03-31', {});
  var l = Closing.pruefeUstvaReadiness(b, '2026-03-01', '2026-03-31', u);
  ok(!!findP(l, /Erstattung/), 'Erstattung-Eintrag vorhanden');
});
test('UStVA-Readiness: Kleinunternehmer überspringt die Prüfungen', function () {
  var b = [{ datum: '2026-03-10', soll: '1200', haben: '4400', betrag: 1000, fest: true }];
  var u = Ustva.berechne(b, '2026-03-01', '2026-03-31', { kleinunternehmer: true });
  var l = Closing.pruefeUstvaReadiness(b, '2026-03-01', '2026-03-31', u);
  eq(l.length, 1, 'nur ein Info-Eintrag');
  eq(l[0].status, 'info', '');
  ok(/Kleinunternehmer/.test(l[0].titel), '');
});

/* ---- HealthCheck Startseite ----------------------------------------- */
test('HealthCheck: leere Stammdaten geben Achtung', function () {
  var l = HealthCheck.pruefe({}, []);
  eq(l[0].titel, 'Stammdaten', '');
  eq(l[0].status, 'achtung', '');
});
test('HealthCheck: vollständige Stammdaten = ok', function () {
  var u = { name: 'Demo', steuernummer: '1', gruendungsdatum: '2024-01-01', stammkapital: 25000 };
  var l = HealthCheck.pruefe(u, []);
  eq(l[0].status, 'ok', '');
});
test('HealthCheck: alter Backup-Stand wird gemeldet (Website-Modus)', function () {
  var l = HealthCheck.pruefe({ name: 'X', steuernummer: '1', gruendungsdatum: '2024-01-01', stammkapital: 25000 }, [],
    { modus: 'website', letzteSicherung: '2025-01-01', heute: '2026-05-20' });
  var b = l.find(function (x) { return /Backup/.test(x.titel); });
  ok(b, '');
  eq(b.status, 'achtung', 'altes Backup');
});
test('HealthCheck: Selbst-Hosting-Modus zeigt keinen Backup-Eintrag', function () {
  var l = HealthCheck.pruefe({ name: 'X', steuernummer: '1', gruendungsdatum: '2024-01-01', stammkapital: 25000 }, []);
  ok(!l.find(function (x) { return /Backup/.test(x.titel); }), 'kein Backup-Eintrag im Selbst-Hosting');
});

/* ---- Importprotokoll: nachvollziehbarer Eintrag je Import ------------- */
test('Importprotokoll: eintrag aus CAMT-Ergebnis zählt Einträge und Bereich', function () {
  var parsed = { tx: [
    { datum: '2026-03-05', betrag: 100, eingang: true },
    { datum: '2026-01-12', betrag: 50, eingang: false },
    { datum: '2026-02-28', betrag: 30, eingang: true }
  ] };
  var e = ImportProtokoll.eintrag('CAMT.053', parsed, { zeit: '2026-06-07T10:00:00Z' });
  eq(e.format, 'CAMT.053', 'Format');
  eq(e.zeit, '2026-06-07T10:00:00Z', 'Zeit injiziert');
  eq(e.anzahlErkannt, 3, 'Anzahl erkannt');
  eq(e.anzahlUebernommen, 3, 'Default uebernommen = erkannt');
  eq(e.anzahlUebersprungen, 0, 'Default uebersprungen 0');
  eq(e.datumsbereich.von, '2026-01-12', 'frühestes Datum');
  eq(e.datumsbereich.bis, '2026-03-05', 'spätestes Datum');
});
test('Importprotokoll: eintrag aus DATEV-Ergebnis (buchungen) normalisiert', function () {
  var parsed = { buchungen: [
    { datum: '2025-12-31', betrag: 10, soll: '1200', haben: '4400' },
    { datum: '2025-06-01', betrag: 20, soll: '1200', haben: '4400' }
  ], jahr: '2025' };
  var e = ImportProtokoll.eintrag('DATEV', parsed, { zeit: 'z', uebernommen: 2, uebersprungen: 0 });
  eq(e.anzahlErkannt, 2, 'aus buchungen gezählt');
  eq(e.datumsbereich.von, '2025-06-01', 'von');
  eq(e.datumsbereich.bis, '2025-12-31', 'bis');
});
test('Importprotokoll: übersprungene Duplikate werden festgehalten', function () {
  var parsed = { tx: [{ datum: '2026-01-01', betrag: 1 }, { datum: '2026-01-02', betrag: 2 }] };
  var e = ImportProtokoll.eintrag('MT940', parsed, { zeit: 'z', uebernommen: 1, uebersprungen: 1 });
  eq(e.anzahlErkannt, 2, 'erkannt');
  eq(e.anzahlUebernommen, 1, 'übernommen');
  eq(e.anzahlUebersprungen, 1, 'übersprungen');
});
test('Importprotokoll: leere/ungültige Datumsangaben werden im Bereich ignoriert', function () {
  var parsed = { buchungen: [
    { datum: '', betrag: 1 },
    { datum: '2026-04-10', betrag: 2 },
    { datum: 'kaputt', betrag: 3 }
  ] };
  var e = ImportProtokoll.eintrag('DATEV', parsed, { zeit: 'z' });
  eq(e.anzahlErkannt, 3, 'alle gezählt');
  eq(e.datumsbereich.von, '2026-04-10', 'nur gültiges Datum');
  eq(e.datumsbereich.bis, '2026-04-10', 'nur gültiges Datum');
});
test('Importprotokoll: ohne gültiges Datum ist der Bereich null', function () {
  var e = ImportProtokoll.eintrag('MT940', { tx: [{ datum: '' }, {}] }, { zeit: 'z' });
  eq(e.anzahlErkannt, 2, 'gezählt');
  eq(e.datumsbereich, null, 'kein Bereich');
});
test('Importprotokoll: leeres/fehlerhaftes Ergebnis liefert Nulleintrag', function () {
  var e1 = ImportProtokoll.eintrag('CAMT.053', { fehler: 'kaputt' }, { zeit: 'z' });
  eq(e1.anzahlErkannt, 0, 'Fehlerergebnis = 0 erkannt');
  eq(e1.datumsbereich, null, 'kein Bereich');
  var e2 = ImportProtokoll.eintrag('CAMT.053', null, { zeit: 'z' });
  eq(e2.anzahlErkannt, 0, 'null-Ergebnis = 0 erkannt');
});
test('Importprotokoll: dateiname und dateiHash werden nur bei Angabe gesetzt', function () {
  var ohne = ImportProtokoll.eintrag('MT940', { tx: [] }, { zeit: 'z' });
  ok(!('dateiname' in ohne), 'kein dateiname ohne Angabe');
  ok(!('dateiHash' in ohne), 'kein dateiHash ohne Angabe');
  var mit = ImportProtokoll.eintrag('MT940', { tx: [] },
    { zeit: 'z', dateiname: 'kontoauszug.sta', dateiHash: 'abc123' });
  eq(mit.dateiname, 'kontoauszug.sta', 'dateiname gesetzt');
  eq(mit.dateiHash, 'abc123', 'dateiHash gesetzt');
});
test('Importprotokoll: anhaengen stellt jüngsten voran und mutiert nicht', function () {
  var alt = [{ format: 'DATEV', zeit: '2026-01-01T00:00:00Z' }];
  var e = ImportProtokoll.eintrag('CAMT.053', { tx: [{ datum: '2026-02-01' }] }, { zeit: '2026-02-02T00:00:00Z' });
  var neu = ImportProtokoll.anhaengen(alt, e);
  eq(neu.length, 2, 'beide drin');
  eq(neu[0].format, 'CAMT.053', 'jüngster vorne');
  eq(alt.length, 1, 'Original unverändert (immutabel)');
});
test('Importprotokoll: anhaengen begrenzt die Länge', function () {
  var arr = [];
  for (var i = 0; i < 5; i++) {
    arr = ImportProtokoll.anhaengen(arr, { format: 'X', zeit: String(i) }, 3);
  }
  eq(arr.length, 3, 'auf maxLen begrenzt');
  eq(arr[0].zeit, '4', 'jüngster zuerst');
  eq(arr[2].zeit, '2', 'ältester gefallen');
});
test('Importprotokoll: istWiederholung erkennt bekannten Datei-Hash', function () {
  var log = [{ format: 'CAMT.053', dateiHash: 'deadbeef' }, { format: 'MT940' }];
  ok(ImportProtokoll.istWiederholung(log, 'deadbeef'), 'bekannter Hash');
  ok(!ImportProtokoll.istWiederholung(log, 'cafe'), 'unbekannter Hash');
  ok(!ImportProtokoll.istWiederholung(log, ''), 'leerer Hash = false');
  ok(!ImportProtokoll.istWiederholung(null, 'x'), 'kein Protokoll = false');
});

/* ---- lib/store.js mandantenfaehig (Welle 7, Server) ------------------- */
(function () {
  var sfs = require('fs'), sos = require('os'), spath = require('path');
  function frischesData() {
    var d = spath.join(sos.tmpdir(), 'obz-store-' + process.pid + '-' + (storeTmpN++));
    sfs.mkdirSync(d, { recursive: true });
    Store.setDataDir(d);
    return d;
  }
  var storeTmpN = 0;

  test('Store: speichert/laedt Unternehmen + Abschluss unter standard (Default-Mandant)', function () {
    var d = frischesData();
    Store.init();
    Store.speichereUnternehmen({ name: 'Muster GmbH', rechtsform: 'GmbH' });
    Store.speichereAbschluss({ id: 'A-1', stichtag: '2024-12-31', art: 'JAHRESABSCHLUSS' });
    var u = Store.ladeUnternehmen();
    eq(u && u.name, 'Muster GmbH', 'Unternehmen geladen');
    var liste = Store.listeAbschluesse();
    eq(liste.length, 1, 'ein Abschluss');
    eq(liste[0].id, 'A-1', 'Abschluss-id');
    ok(sfs.existsSync(spath.join(d, 'mandanten', 'standard', 'unternehmen.json')),
      'Datei liegt unter mandanten/standard/');
    var mand = JSON.parse(sfs.readFileSync(spath.join(d, 'mandanten.json'), 'utf8'));
    ok(mand.some(function (m) { return m.id === 'standard'; }), 'standard im Index');
    eq(mand.filter(function (m) { return m.id === 'standard'; })[0].name, 'Muster GmbH',
      'Mandantenname aus Unternehmen');
  });

  test('Store: Mandanten sind isoliert (standard vs. firma2)', function () {
    frischesData();
    Store.init();
    Store.speichereAbschluss({ id: 'A-S', stichtag: '2024-12-31' });               // standard
    Store.speichereAbschluss({ id: 'A-2', stichtag: '2024-12-31' }, 'firma2');      // anderer Mandant
    eq(Store.listeAbschluesse().length, 1, 'standard hat 1');
    eq(Store.listeAbschluesse('firma2').length, 1, 'firma2 hat 1');
    eq(Store.ladeAbschluss('A-2', 'firma2').id, 'A-2', 'firma2-Abschluss ladbar');
    eq(Store.ladeAbschluss('A-2'), null, 'firma2-Abschluss NICHT unter standard sichtbar');
    eq(Store.ladeAbschluss('A-S', 'firma2'), null, 'standard-Abschluss NICHT unter firma2');
  });

  test('Store: init migriert altes einfirmiges Layout nach mandanten/standard/', function () {
    var d = frischesData();
    /* Altes Layout direkt anlegen (vor mandantenfaehigem Store). */
    sfs.writeFileSync(spath.join(d, 'unternehmen.json'),
      JSON.stringify({ name: 'Alt GmbH' }), 'utf8');
    sfs.mkdirSync(spath.join(d, 'abschluesse'), { recursive: true });
    sfs.writeFileSync(spath.join(d, 'abschluesse', 'A-alt.json'),
      JSON.stringify({ id: 'A-alt', stichtag: '2023-12-31' }), 'utf8');
    Store.init();   // soll automatisch migrieren
    eq(Store.ladeUnternehmen() && Store.ladeUnternehmen().name, 'Alt GmbH',
      'altes Unternehmen unter standard auffindbar');
    var liste = Store.listeAbschluesse();
    eq(liste.length, 1, 'alter Abschluss migriert');
    eq(liste[0].id, 'A-alt', 'alte id erhalten');
    ok(sfs.readdirSync(d).some(function (f) { return /^\.backup-pre-mandanten-/.test(f); }),
      'Pre-Backup angelegt');
    ok(sfs.existsSync(spath.join(d, 'unternehmen.json')),
      'Originaldatei bleibt (kopiert, nicht verschoben)');
  });

  test('Store: mandantAnlegen legt Eintrag + Ordner an, Duplikat wird abgelehnt', function () {
    frischesData();
    Store.init();
    var r1 = Store.mandantAnlegen('Zweite GmbH', 'zweite');
    eq(r1.ok, true, 'erster Anlauf ok');
    eq(r1.id, 'zweite', 'id gesetzt');
    ok(Store.listeMandanten().some(function (m) { return m.id === 'zweite'; }), 'im Index');
    var r2 = Store.mandantAnlegen('Zweite GmbH', 'zweite');
    eq(r2.ok, false, 'Duplikat abgelehnt');
    eq(r2.grund, 'existiert', 'Grund Duplikat');
  });

  test('Store: ladeAbschluss Feld-Quergriff-Sperre (W4) + mandantId am Satz', function () {
    var d = frischesData();
    Store.init();
    var gesp = Store.speichereAbschluss({ id: 'A-OK', stichtag: '2024-12-31' }, 'firma2');
    eq(gesp.mandantId, 'firma2', 'mandantId wird am Satz geführt (W4)');
    var ok = Store.ladeAbschluss('A-OK', 'firma2');
    eq(ok && ok.id, 'A-OK', 'eigener Satz lädt');
    /* Datei mit FREMDEM mandantId-Feld direkt in firma2/ ablegen (über die API
     * nicht erzeugbar) -> Feld-Sperre muss greifen, nicht nur die Verzeichnistrennung. */
    sfs.writeFileSync(spath.join(d, 'mandanten', 'firma2', 'abschluesse', 'A-BAD.json'),
      JSON.stringify({ id: 'A-BAD', mandantId: 'andere', stichtag: '2024-12-31' }), 'utf8');
    eq(Store.ladeAbschluss('A-BAD', 'firma2'), null, 'fremdes mandantId-Feld -> null');
  });
})();

/* ---- IDB-Migration v1->v2 (fake-indexeddb, W3-bis) -------------------- */
/* Deckt den einzigen sonst ungetesteten Laufzeit-Pfad ab: store-idb.js
 * onupgradeneeded (migriereV1zuV2). Graceful-Skip ohne fake-indexeddb -> der
 * Standardlauf `node tests/run.js` bleibt zero-install grün. */
(function () {
  var fakeOk = false;
  try { require('fake-indexeddb/auto'); fakeOk = true; } catch (e) { fakeOk = false; }
  if (!fakeOk) {
    test('IDB-Migration v1->v2: übersprungen (fake-indexeddb nicht installiert)', function () {
      ok(true, 'optional: `npm install` aktiviert die IDB-onupgradeneeded-Tests');
    });
    return;
  }
  var StoreIDB = require('../public/shared/store-idb.js');
  var DBNAME = 'openbilanz';

  function del() {
    return new Promise(function (res) {
      var r = indexedDB.deleteDatabase(DBNAME);
      r.onsuccess = r.onerror = r.onblocked = function () { res(); };
    });
  }
  /* Roh eine v1-DB im Schema von store-idb v1 aufbauen + befuellen. */
  function baueV1(daten) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DBNAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        db.createObjectStore('unternehmen', { keyPath: '_id' });
        var ab = db.createObjectStore('abschluesse', { keyPath: 'id' });
        ab.createIndex('stichtag', 'stichtag', { unique: false });
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = function () {
        var db = req.result;
        var t = db.transaction(['unternehmen', 'abschluesse'], 'readwrite');
        if (daten.unternehmen) {
          var u = JSON.parse(JSON.stringify(daten.unternehmen)); u._id = 'singleton';
          t.objectStore('unternehmen').put(u);
        }
        (daten.abschluesse || []).forEach(function (a) { t.objectStore('abschluesse').put(a); });
        t.oncomplete = function () { db.close(); resolve(); };
        t.onerror = function () { reject(t.error); };
      };
      req.onerror = function () { reject(req.error); };
    });
  }
  function frischeIDB(daten) {
    StoreIDB._resetCache();
    return del().then(function () { return baueV1(daten); })
      .then(function () { StoreIDB._resetCache(); });   /* nächstes offen() -> v2-Upgrade */
  }

  test('IDB v1->v2: befüllte Alt-DB wird verlustfrei nach Mandant standard migriert', function () {
    return frischeIDB({
      unternehmen: { name: 'Muster GmbH', rechtsform: 'GmbH' },
      abschluesse: [
        { id: 'A-1', stichtag: '2024-12-31', art: 'JAHRESABSCHLUSS', buchungen: [{ x: 1 }] },
        { id: 'A-2', stichtag: '2023-12-31', art: 'EROEFFNUNGSBILANZ' }
      ]
    }).then(function () {
      return Promise.all([
        StoreIDB.listeMandanten(),
        StoreIDB.ladeUnternehmen('standard'),
        StoreIDB.listeAbschluesse('standard'),
        StoreIDB.getMeta('mandantenMigrationHinweis')
      ]);
    }).then(function (r) {
      var mand = r[0], unt = r[1], absl = r[2], flag = r[3];
      eq(mand.length, 1, 'genau ein Mandant');
      eq(mand[0].id, 'standard', 'Mandant-id standard');
      eq(mand[0].name, 'Muster GmbH', 'Mandantenname aus Unternehmen');
      eq(unt && unt.name, 'Muster GmbH', 'Unternehmen unter standard');
      eq(absl.length, 2, 'beide Abschlüsse erhalten (verlustfrei)');
      var ids = absl.map(function (a) { return a.id; }).sort().join(',');
      eq(ids, 'A-1,A-2', 'beide ids erhalten');
      ok(absl.every(function (a) { return a.mandantId === 'standard'; }), 'mandantId gesetzt');
      var a1 = absl.filter(function (a) { return a.id === 'A-1'; })[0];
      ok(a1.buchungen && a1.buchungen.length === 1, 'Nutzdaten (buchungen) erhalten');
      ok(flag, 'W3: Backup-Hinweis-Flag gesetzt');
    });
  });

  test('IDB v1->v2: leere Alt-DB erzeugt KEINEN Phantom-Mandanten', function () {
    return frischeIDB({}).then(function () {
      return Promise.all([StoreIDB.listeMandanten(), StoreIDB.getMeta('mandantenMigrationHinweis')]);
    }).then(function (r) {
      eq(r[0].length, 0, 'kein Mandant bei leerer Alt-DB');
      ok(!r[1], 'kein Backup-Hinweis ohne Daten');
    });
  });

  test('IDB v1->v2: Mandanten-Isolation nach Migration (Quergriff null)', function () {
    return frischeIDB({
      unternehmen: { name: 'Iso GmbH' },
      abschluesse: [{ id: 'A-iso', stichtag: '2024-12-31' }]
    }).then(function () {
      return StoreIDB.speichereAbschluss({ id: 'A-f2', stichtag: '2024-12-31' }, 'firma2');
    }).then(function () {
      return Promise.all([
        StoreIDB.listeAbschluesse('standard'),
        StoreIDB.listeAbschluesse('firma2'),
        StoreIDB.ladeAbschluss('A-f2', 'standard')   /* Quergriff */
      ]);
    }).then(function (r) {
      eq(r[0].length, 1, 'standard sieht nur eigenen');
      eq(r[1].length, 1, 'firma2 sieht nur eigenen');
      eq(r[2], null, 'Quergriff auf fremden Abschluss -> null');
    });
  });
})();

/* ---- Unterschriften-PDF (AcroForm via pdf-lib, optional) -------------- */
(function () {
  var PL = null;
  try { PL = require('pdf-lib'); } catch (e) { PL = null; }
  if (!PL) {
    test('Unterschriften-PDF: übersprungen (pdf-lib nicht installiert)', function () {
      ok(true, 'optional: `npm install` aktiviert die AcroForm-Tests');
    });
    return;
  }
  test('Unterschriften-PDF: erzeugt gültiges PDF mit ausfüllbaren Feldern', function () {
    return UnterschriftPdf.erzeuge(
      { name: 'Muster GmbH', geschaeftsfuehrerText: 'Anna Admin, Bob Boss' },
      { art: 'EROEFFNUNGSBILANZ', stichtag: '2024-01-01' }
    ).then(function (bytes) {
      ok(bytes && bytes.length > 800, 'PDF-Bytes erzeugt');
      return PL.PDFDocument.load(bytes);
    }).then(function (doc) {
      var namen = doc.getForm().getFields().map(function (f) { return f.getName(); });
      ok(namen.indexOf('ort') >= 0, 'Feld ort vorhanden');
      ok(namen.indexOf('datum') >= 0, 'Feld datum vorhanden');
      ok(namen.indexOf('unterschrift_1') >= 0, 'Unterschriftsfeld GF 1');
      ok(namen.indexOf('unterschrift_2') >= 0, 'Unterschriftsfeld GF 2 (zweiter GF)');
    });
  });
  test('Unterschriften-PDF: gfNamen + titelFuer', function () {
    eq(UnterschriftPdf.gfNamen({ geschaeftsfuehrerText: 'A, B' }).length, 2, 'zwei GF');
    eq(UnterschriftPdf.gfNamen({}).length, 1, 'Fallback: ein (leeres) Feld');
    eq(UnterschriftPdf.titelFuer({ art: 'EROEFFNUNGSBILANZ', stichtag: '2024-01-01' }),
      'Eröffnungsbilanz zum 2024-01-01', 'Titel EB');
  });
})();

/* ---- Fristen: Übermittlungs-Hinweise (wohin/wie) --------------------- */
(function () {
  test('Fristen: uebermittlungFuer je Pflicht-Art (verifizierte Wege)', function () {
    var off = Fristen.uebermittlungFuer('offenlegung');
    ok(off && /Unternehmensregister/.test(off.text), 'Offenlegung -> Unternehmensregister');
    eq(off.link, 'https://www.unternehmensregister.de', 'Offenlegung-Link');
    ok(/nicht mehr beim Bundesanzeiger/.test(off.text), '§325-Stand: nicht Bundesanzeiger');
    var ust = Fristen.uebermittlungFuer('ustva');
    ok(ust && /ELSTER/.test(ust.text) && ust.link === 'https://www.elster.de', 'UStVA -> ELSTER');
    ok(/aufbewahren/.test(Fristen.uebermittlungFuer('aufbewahrung').text), 'Aufbewahrung: keine Abgabe');
    eq(Fristen.uebermittlungFuer('gibtsnicht'), null, 'unbekannte Art -> null');
  });
  test('Fristen: naechsteFristen hängt uebermittlung je Eintrag an', function () {
    var fr = Fristen.naechsteFristen({}, [{ id: 'x', art: 'JAHRESABSCHLUSS',
      stichtag: '2024-12-31', bezeichnung: 'JA 2024' }]);
    var off = fr.filter(function (f) { return f.art === 'offenlegung'; })[0];
    ok(off && off.uebermittlung && /Unternehmensregister/.test(off.uebermittlung.text),
      'Offenlegungs-Frist trägt Übermittlungs-Hinweis');
    var ust = fr.filter(function (f) { return f.art === 'ustva'; })[0];
    ok(ust && ust.uebermittlung && ust.uebermittlung.link === 'https://www.elster.de',
      'UStVA-Frist trägt ELSTER-Link');
  });
})();

/* ---- Vollständiges Bilanz-PDF (bilanz-pdf.js, T-0153) ----------------- */
(function () {
  var BilanzPdf = require('../public/shared/bilanz-pdf.js');
  // mock r: passiver §272-Pfad (Stammkapital 25000, davon 12500 nicht eingefordert)
  var rPassiv = { bilanz: {
    aktiva: { 'B': 12500, 'B.IV': 12500 }, passiva: { 'P.A': 12500 },
    kapital: { gezeichnet: 25000, eingezahlt: 12500, nichtEingefordert: 12500, eingefordertesKapital: 12500, eingefordertOffen: 0 },
    summeAktiva: 12500, summePassiva: 12500
  }, guv: { werte: {} } };

  test('Bilanz-PDF Extraktor: Summen konsistent + §272-Passivpfad', function () {
    var za = BilanzPdf.bilanzZeilen('aktiva', rPassiv);
    var zp = BilanzPdf.bilanzZeilen('passiva', rPassiv);
    eq(za[za.length - 1].betrag, 12500, 'Summe Aktiva == r.bilanz.summeAktiva');
    eq(zp[zp.length - 1].betrag, 12500, 'Summe Passiva == r.bilanz.summePassiva');
    var labels = zp.map(function (z) { return z.label; });
    ok(labels.indexOf('Nicht eingeforderte ausstehende Einlagen') >= 0, '§272: Absetzung sichtbar');
    ok(labels.indexOf('Eingefordertes Kapital') >= 0, '§272: eingefordertes Kapital');
    var davon = zp.filter(function (z) { return z.label === 'Nicht eingeforderte ausstehende Einlagen'; })[0];
    ok(davon && davon.betrag < 0, '§272: Absetzung negativ');
    ok(labels.indexOf('davon eingezahlt') >= 0, '§272: davon eingezahlt sichtbar');
    var eingez = zp.filter(function (z) { return z.label === 'davon eingezahlt'; })[0];
    eq(eingez.betrag, 12500, 'davon eingezahlt = 12.500 im Ausweis');
    eq(zp[zp.length - 1].betragText, '12.500,00 EUR', 'deutsche Geldformatierung');
  });

  test('Bilanz-PDF Extraktor: §272-Aktivpfad (eingefordertes offenes Kapital)', function () {
    var rAkt = { bilanz: {
      aktiva: { 'B': 25000, 'B.II': 12500, 'B.IV': 12500 }, passiva: { 'P.A': 25000 },
      kapital: { gezeichnet: 25000, nichtEingefordert: 0, eingefordertesKapital: 25000, eingefordertOffen: 12500 },
      summeAktiva: 25000, summePassiva: 25000
    }, guv: { werte: {} } };
    var labels = BilanzPdf.bilanzZeilen('aktiva', rAkt).map(function (z) { return z.label; });
    ok(labels.indexOf('davon eingefordertes, noch nicht eingezahltes Kapital') >= 0, '§272 aktiv: davon-Zeile');
  });

  test('Bilanz-PDF Extraktor: anhangAbsaetze + guvZeilen', function () {
    var k = BilanzPdf.anhangAbsaetze({ groessenklasse: 'KLEINST', anhang: {} });
    ok(/Angaben unter der Bilanz/.test(k.titel), 'Kleinst: Angaben unter der Bilanz');
    eq(BilanzPdf.anhangAbsaetze({ groessenklasse: 'KLEIN', anhang: { arbeitnehmer: 5 } }).titel,
      'Anhang', 'nicht-Kleinst: Anhang');
    var g = BilanzPdf.guvZeilen({ guvVerfahren: 'GKV' }, { guv: { werte: { 'gkv.1': 1000 } } });
    ok(g.length > 0 && g.some(function (x) { return x.ebene === 'summe'; }), 'GuV: Summen markiert');
  });

  test('Bilanz-PDF: gfNamen verträgt String UND Array (echte Persistenzform)', function () {
    eq(BilanzPdf.gfNamen({ geschaeftsfuehrerText: 'Anna, Bob' }).length, 2, 'String-Form: 2 GF');
    eq(BilanzPdf.gfNamen({ geschaeftsfuehrer: ['Anna', 'Bob'] }).length, 2, 'Array-Form: 2 GF');
    eq(BilanzPdf.gfNamen({}).length, 1, 'Fallback: ein (leeres) Unterschriftsfeld');
    eq(BilanzPdf.geld(-12500), '-12.500,00', 'Geldformat negativ deutsch');
  });

  var PL2 = null;
  try { PL2 = require('pdf-lib'); } catch (e) { PL2 = null; }
  if (!PL2) {
    test('Bilanz-PDF (AcroForm): übersprungen (pdf-lib nicht installiert)', function () {
      ok(true, 'optional: `npm install` aktiviert den Voll-PDF-Test');
    });
    return;
  }
  test('Bilanz-PDF: gültiges PDF mit Bilanz-Inhalt + ausfüllbaren Feldern', function () {
    return BilanzPdf.erzeuge(
      { name: 'Muster GmbH', plz: '12345', ort: 'Musterstadt', hrNummer: 'HRB 1',
        geschaeftsfuehrerText: 'Anna Admin, Bob Boss' },
      { art: 'EROEFFNUNGSBILANZ', stichtag: '2024-01-01', groessenklasse: 'KLEINST', anhang: {} },
      rPassiv
    ).then(function (bytes) {
      ok(bytes && bytes.length > 2000, 'PDF-Bytes (mit Bilanz) erzeugt');
      return PL2.PDFDocument.load(bytes);
    }).then(function (doc) {
      var namen = doc.getForm().getFields().map(function (f) { return f.getName(); });
      ok(namen.indexOf('ort') >= 0, 'Feld ort');
      ok(namen.indexOf('datum') >= 0, 'Feld datum');
      ok(namen.indexOf('unterschrift_1') >= 0, 'Unterschrift GF1');
      ok(namen.indexOf('unterschrift_2') >= 0, 'Unterschrift GF2');
      ok(doc.getPageCount() >= 1, 'mind. 1 Seite');
    });
  });
})();

/* ---- Review-Nachtests (Code-Review 2026-06) ---------------------------- */
test('Closing: Storno-GEGENBUCHUNG zählt ebenfalls nicht (Paar hebt sich auf)', function () {
  var bu = [{ soll: '1800', haben: '4400', betrag: 100 },
            { id: 'b2', soll: '6300', haben: '1800', betrag: 30, storniert: true },
            { soll: '1800', haben: '6300', betrag: 30, stornoVon: 'b2' }];
  ok(!Closing.hatKonto(bu, '6300'), 'Storno-Paar 6300 zählt komplett nicht');
  eq(Closing.summeKonto(bu, '1800').saldo, 100, 'Saldo 1800 ohne beide Storno-Seiten');
});

test('baumSummen: explizit auf 0 erfasste Kinder überstimmen den Elternwert', function () {
  var baum = [{ id: 'X', kinder: [{ id: 'X.1' }, { id: 'X.2' }] }];
  var alt = Berechnung.baumSummen(baum, { 'X': 100 });
  eq(alt['X'], 100, 'ohne Kindwerte gilt der Eltern-Direktwert');
  var neu = Berechnung.baumSummen(baum, { 'X': 100, 'X.1': 0, 'X.2': 0 });
  eq(neu['X'], 0, 'explizite Null-Kinder ergeben 0 statt Elternwert');
  var teils = Berechnung.baumSummen(baum, { 'X': 100, 'X.1': 40 });
  eq(teils['X'], 40, 'ein belegtes Kind reicht für die Kindersumme');
});

test('num: deutsches Tausenderformat "1.234,56" wird korrekt gelesen', function () {
  eq(Berechnung.num('1.234,56'), 1234.56, 'Tausenderpunkt + Komma');
  eq(Berechnung.num('12.345.678,90'), 12345678.9, 'mehrere Tausenderpunkte');
  eq(Berechnung.num('1.234'), 1.234, 'ohne Komma bleibt der Punkt Dezimaltrenner');
  eq(Berechnung.num('1234,56'), 1234.56, 'Komma als Dezimaltrenner');
});

test('Steuer: getrennter Gewerbeverlust (§ 10a GewStG) wird angesetzt', function () {
  var basis = { art: 'JAHRESABSCHLUSS', stichtag: '2026-12-31', werte: {},
    steuer: { hebesatz: 400, verlustvortrag: 50000 } };
  var guv = { werte: {}, jahresergebnis: 100000 };
  var a = Steuer.berechne(basis, guv);
  eq(a.verlustvortrag.eingesetztKst, 50000, 'KSt-Topf voll eingesetzt');
  eq(a.verlustvortrag.eingesetztGewSt, 50000, 'ohne eigenes Feld: GewSt wie KSt (Näherung)');
  var basis2 = JSON.parse(JSON.stringify(basis));
  basis2.steuer.verlustvortragGewSt = 10000;
  var b = Steuer.berechne(basis2, guv);
  eq(b.verlustvortrag.eingesetztGewSt, 10000, 'eigener GewSt-Topf wird angesetzt');
  eq(b.verlustvortrag.eingesetztKst, 50000, 'KSt-Topf bleibt unverändert');
  ok(b.gewst.betrag > a.gewst.betrag, 'kleinerer GewSt-Topf -> mehr Gewerbesteuer');
});

test('MT940: zweistelliges Jahr > 50 wird als 19xx gelesen (Fenster-Verfahren)', function () {
  eq(Mt940.isoDatum('991231'), '1999-12-31', 'historischer Auszug 1999');
  eq(Mt940.isoDatum('260110'), '2026-01-10', 'aktuelles Datum 2026');
});

/* ---- Konten-Suche (Buchungshilfe/Glossar, T-0156) ----------------------- */
test('SKR04Glossar.suche: Glossar-Logik mit und ohne Suchbegriff, Deckelung', function () {
  var G = require('../public/shared/skr04-glossar.js');
  var konten = [
    { nr: '1800', name: 'Bank (Guthaben bei Kreditinstituten)' },   // hat Erklärung
    { nr: '4400', name: 'Erlöse 19 % USt' },
    { nr: '6310', name: 'Miete (unbewegliche Wirtschaftsgüter)' },
    { nr: '9999', name: 'Fantasiekonto ohne Erklärung' }
  ];
  // ohne Suchbegriff: nur Konten MIT eigener Erklärung
  var leer = G.suche(konten, '', 80);
  ok(leer.treffer.every(function (k) { return G.hatErklaerung(k.nr); }),
    'ohne q nur Konten mit Erklärung');
  ok(leer.treffer.some(function (k) { return k.nr === '1800'; }), '1800 ist dabei');
  ok(!leer.treffer.some(function (k) { return k.nr === '9999'; }), '9999 nicht dabei');
  // mit Suchbegriff: Nr, Name UND Erklärtext werden durchsucht
  eq(G.suche(konten, '9999', 80).treffer.length, 1, 'Treffer über die Nummer');
  eq(G.suche(konten, 'miete', 80).treffer[0].nr, '6310', 'Treffer über den Namen');
  ok(G.suche(konten, 'Kontoauszug', 80).treffer.some(function (k) { return k.nr === '1800'; }),
    'Treffer über den Erklärtext (1800 erwähnt den Kontoauszug)');
  // Deckelung: max greift, gesamt bleibt ehrlich
  var res = G.suche(konten, 'e', 2);
  eq(res.treffer.length, 2, 'max deckelt die Treffer');
  ok(res.gesamt >= res.treffer.length, 'gesamt >= angezeigte Treffer');
});

/* ---- Lauf ------------------------------------------------------------- */
/* Sequenziell laufen lassen, async-Tests (Promise-Rückgabewert) werden
 * abgewartet, ohne dass synchrone Tests darauf umgeschrieben werden müssen. */
console.log('OpenBilanz - Test-Suite\n');
(function run() {
  var idx = 0;
  function step() {
    if (idx >= tests.length) {
      console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
      process.exit(fail ? 1 : 0);
    }
    var t = tests[idx++];
    var r;
    try { r = t.fn(); }
    catch (e) {
      fail++; console.log('  FAIL  ' + t.name + '\n        -> ' + e.message);
      return step();
    }
    if (r && typeof r.then === 'function') {
      r.then(function () { pass++; console.log('  OK    ' + t.name); step(); },
             function (e) { fail++; console.log('  FAIL  ' + t.name +
               '\n        -> ' + (e && e.message || e)); step(); });
    } else {
      pass++; console.log('  OK    ' + t.name); step();
    }
  }
  step();
})();
