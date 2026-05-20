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

var tests = [], pass = 0, fail = 0;
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function eq(a, b, msg) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 0.005) throw new Error((msg || '') + ' erwartet ' + b + ', war ' + a);
  } else if (a !== b) throw new Error((msg || '') + ' erwartet ' + b + ', war ' + a);
}
function ok(c, msg) { if (!c) throw new Error(msg || 'Bedingung nicht erfuellt'); }

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
test('§ 268 Abs. 3: nicht durch EK gedeckter Fehlbetrag', function () {
  // Stammkapital 25.000 aufgezehrt durch Verlust 85.000 -> EK = -60.000
  var ja = { art: 'JAHRESABSCHLUSS', guvVerfahren: 'GKV',
    kapital: { gezeichnet: 25000, eingezahlt: 25000, eingefordertOffen: 0 },
    werte: { aktiva: { 'B.IV': 5000 }, passiva: { 'P.C.4': 125000 },
      guv: { 'gkv.8': 85000 } } };
  var r = Berechnung.berechne(ja).bilanz;
  eq(r.fehlbetrag, 60000, 'Fehlbetrag');
  ok(r.ausgeglichen, 'Bilanz trotz Fehlbetrag ausgeglichen');
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
test('UStVA: § 13b - geschuldete Steuer und Vorsteuer heben sich auf', function () {
  var u = Ustva.berechne([], null, null, { rc13b: { netto19: 1000 } });
  eq(u.kz84, 190, 'Kz 84 = 19 % von 1.000');
  eq(u.kz66, 190, '§ 13b-Steuer zugleich als Vorsteuer abziehbar');
  eq(u.kz83, 0, 'netto Null bei voller Abzugsberechtigung');
});
test('UStVA: § 13b zusätzlich zur eigenen Umsatzsteuer', function () {
  var bu = [{ datum: '2026-01-10', soll: '1800', haben: '4400', betrag: 10000 }];
  var u = Ustva.berechne(bu, null, null, { rc13b: { netto19: 2000 } });
  eq(u.ust19, 1900, 'eigene USt 19 %');
  eq(u.kz84, 380, '§ 13b-Steuer 19 % von 2.000');
  eq(u.kz83, 1900, 'Zahllast = eigene USt (1900 + 380 - 380)');
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
