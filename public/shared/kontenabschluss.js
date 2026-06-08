/* ===========================================================================
 * kontenabschluss.js  -  Salden -> Bilanz-/GuV-Werte (reine Abschluss-Logik)
 * ---------------------------------------------------------------------------
 * Aggregiert die Kontensalden eines Buchhaltungs-Abschlusses zu den HGB-
 * Bilanzpositionen (§ 266) und GuV-Kategorien (§ 275). Aus app.js extrahiert,
 * damit die Logik testbar ist (uebernehmeSalden ruft salden2werte auf).
 *
 * Saldo je Konto = soll - haben  (Aktiv/Aufwand normal positiv; Passiv/Ertrag
 * normal negativ). VORZEICHENRICHTIG aggregiert:
 *   AKTIV  : + saldo
 *   PASSIV : - saldo
 *   ERTRAG : - saldo   (Haben-Überhang = Ertrag; Soll-Überhang mindert -> Kontra)
 *   AUFWAND: + saldo   (Soll-Überhang = Aufwand; Haben-Überhang mindert -> Kontra)
 * Damit mindern Kontra-Konten (Erlösschmälerungen, erhaltene/gewährte Skonti,
 * Boni, Nachlässe) ihre Kategorie KORREKT — ein früheres Math.abs hätte sie
 * fälschlich aufaddiert und die Bilanz unausgeglichen gelassen.
 * ========================================================================= */
(function (root, factory) {
  var api = factory(
    typeof require === 'function' ? require('./skr04.js') : root.SKR04,
    typeof require === 'function' ? require('./berechnung.js') : root.Berechnung
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Abschluss = api;
})(typeof self !== 'undefined' ? self : this, function (SKR04, Berechnung) {
  'use strict';

  /* salden: { kontoNr: { soll, haben } }  (z.B. aus kontenSalden()).
   * opt.guvVerfahren: 'GKV' | 'UKV' | 'KLEINST' (Default GKV).
   * Rückgabe: { aktiva:{pos:betrag}, passiva:{pos:betrag}, guv:{posId:betrag},
   *             kapitalGezeichnet: Zahl|null } */
  function salden2werte(salden, opt) {
    opt = opt || {};
    var guvVerfahren = opt.guvVerfahren || 'GKV';
    var aktiva = {}, passiva = {}, guv = {}, kapitalGezeichnet = null, kapitalNichtEingefordert = 0;
    Object.keys(salden || {}).forEach(function (nr) {
      var k = SKR04.kontoFinden(nr);
      if (!k) return;                              // unbekanntes Konto -> ignorieren (s. app.js-Validierung)
      var saldo = (salden[nr].soll || 0) - (salden[nr].haben || 0);
      if (nr === '2900') {                          // Gezeichnetes Kapital -> Kapitalblock
        kapitalGezeichnet = Berechnung.cent(-saldo);
        return;
      }
      if (nr === '2910') {                          // Ausstehende Einlagen, nicht eingefordert (§ 272 Abs.1)
        kapitalNichtEingefordert = Berechnung.cent(saldo);   // Soll-Saldo -> offen vom gez. Kapital abgesetzt
        return;
      }
      if (k.seite === 'EBK') return;                // Eröffnungsbilanzkonto: reines Verrechnungskonto
      if (k.seite === 'AKTIV') {
        aktiva[k.pos] = Berechnung.cent((aktiva[k.pos] || 0) + saldo);
      } else if (k.seite === 'PASSIV') {
        if (k.pos === 'P.A.I' || k.pos === 'P.A.V') return;   // werden automatisch berechnet
        passiva[k.pos] = Berechnung.cent((passiva[k.pos] || 0) - saldo);
      } else if (k.seite === 'ERTRAG' || k.seite === 'AUFWAND') {
        var gid = SKR04.KAT_GUV[k.kat] && SKR04.KAT_GUV[k.kat][guvVerfahren];
        var betrag = (k.seite === 'ERTRAG') ? -saldo : saldo;
        if (gid) guv[gid] = Berechnung.cent((guv[gid] || 0) + betrag);
      }
    });
    return { aktiva: aktiva, passiva: passiva, guv: guv, kapitalGezeichnet: kapitalGezeichnet,
             kapitalNichtEingefordert: kapitalNichtEingefordert };
  }

  return { salden2werte: salden2werte };
});
