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
var XBRL       = require('../public/shared/xbrl.js');

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

/* ---- SKR04-Kontenmapping (Integritaet) ------------------------------- */
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

/* ---- Lauf ------------------------------------------------------------- */
console.log('OpenBilanz - Test-Suite\n');
tests.forEach(function (t) {
  try { t.fn(); pass++; console.log('  OK    ' + t.name); }
  catch (e) { fail++; console.log('  FAIL  ' + t.name + '\n        -> ' + e.message); }
});
console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
