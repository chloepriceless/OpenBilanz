/* ===========================================================================
 * pruefkette.js  -  Integritätssicherung festgeschriebener Buchungen
 * ---------------------------------------------------------------------------
 * Verkettet festgeschriebene Buchungen per SHA-256: jede Buchung erhält einen
 * Hash über IHREN Inhalt + den Hash der Vorgängerbuchung (Hash-Kette). Eine
 * nachträgliche Änderung einer festgeschriebenen Buchung bricht die Kette ab
 * jenem Punkt und wird so ERKENNBAR (§ 146 Abs. 4 AO / GoBD).
 *
 * Wichtig zur Einordnung: Die Kette verhindert Manipulation nicht — wer den
 * Bestand vollständig kontrolliert, könnte sie neu berechnen. Beweiskraft
 * entsteht erst, wenn der Ketten-Kopf-Hash EXTERN verankert wird (z. B.
 * Git-Push auf ein Remote, Ausdruck, Notiz). Die Storno-Markierung gehört
 * bewusst NICHT in den Hash — ein Storno ist ein zulässiger Vorgang und
 * darf die Kette nicht brechen.
 *
 * Reine Funktionen, zero-dependency, in Browser und Node identisch.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pruefkette = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* SHA-256-Rundenkonstanten (§ 4.2.2 FIPS 180-4). */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }

  /* SHA-256 einer Zeichenkette (UTF-8), Ergebnis als 64-stelliger Hex-String. */
  function sha256(text) {
    var str = unescape(encodeURIComponent(String(text == null ? '' : text)));
    var bytes = [], i;
    for (i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64), off, t;
    for (off = 0; off < bytes.length; off += 64) {
      for (t = 0; t < 16; t++) {
        w[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) |
               (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
        var s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3],
          e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0;
      H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hex = '';
    for (i = 0; i < 8; i++) hex += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return hex;
  }

  /* Kanonische, eindeutige Darstellung des unveränderlichen Buchungsinhalts.
   * Bewusst OHNE fest/festAm/storniert/hash - nur der Buchungssatz selbst. */
  function kanonisch(b) {
    return [
      b.id || '', b.datum || '', b.soll || '', b.haben || '',
      (Math.round((Number(b.betrag) || 0) * 100) / 100).toFixed(2),
      String(b.text || '')
    ].join('|');
  }
  function hashFuer(vorHash, b) {
    return sha256(vorHash + '\n' + kanonisch(b));
  }

  /* Weist festgeschriebenen Buchungen ohne Hash einen Ketten-Hash zu; bereits
   * verkettete Buchungen behalten ihren Hash. Liefert den Ketten-Kopf-Hash. */
  function fortschreiben(buchungen) {
    var vor = '';
    (buchungen || []).forEach(function (b) {
      if (!b || !b.fest) return;
      if (b.hash) { vor = b.hash; return; }
      b.hash = hashFuer(vor, b);
      vor = b.hash;
    });
    return vor;
  }

  /* Prüft die Kette nach. Liefert { ok, anzahl, ohneHash, kopf, bruchId }. */
  function pruefe(buchungen) {
    var fest = (buchungen || []).filter(function (b) { return b && b.fest; });
    var verkettet = fest.filter(function (b) { return b.hash; });
    var vor = '', bruchId = null, i;
    for (i = 0; i < verkettet.length && !bruchId; i++) {
      if (hashFuer(vor, verkettet[i]) !== verkettet[i].hash) {
        bruchId = verkettet[i].id || ('#' + (i + 1));
      }
      vor = verkettet[i].hash;
    }
    return {
      ok: !bruchId,
      anzahl: verkettet.length,
      ohneHash: fest.length - verkettet.length,
      kopf: vor,
      bruchId: bruchId
    };
  }

  return { sha256: sha256, kanonisch: kanonisch,
           fortschreiben: fortschreiben, pruefe: pruefe };
});
