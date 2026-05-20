/* ===========================================================================
 * stbpaket.js  -  Steuerberater-Paket als Store-Only-ZIP (zero-dependency)
 * ---------------------------------------------------------------------------
 * Baut eine ZIP-Datei nach APPNOTE.TXT mit Kompression 0 (Store) - kein
 * DEFLATE, also keine externe Lib. Reicht, weil unsere Inhalte (CSV, JSON,
 * HTML) ohnehin gut komprimierbar sind, aber fuer den Steuerberater-Versand
 * sind sie als Sammelpaket genauso brauchbar.
 *
 * API:
 *   baueZip([{ name: 'foo.csv', content: String|Uint8Array }, ...]) -> Uint8Array
 *
 * Das fertige Uint8Array kann im Browser via Blob heruntergeladen oder im
 * Node-Modus als File geschrieben werden.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StbPaket = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // CRC32 (gen. Polynom 0xEDB88320, IEEE 802.3) - Tabelle einmalig
  var CRC = (function () {
    var t = new Array(256), c, i, j;
    for (i = 0; i < 256; i++) {
      c = i;
      for (j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ CRC[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    // Node-Fallback
    var b = Buffer.from(String(s), 'utf8');
    var arr = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) arr[i] = b[i];
    return arr;
  }

  function dosTime(d) {
    return ((d.getHours() & 0x1F) << 11) |
           ((d.getMinutes() & 0x3F) << 5) |
           ((d.getSeconds() >> 1) & 0x1F);
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) & 0x7F) << 9) |
           (((d.getMonth() + 1) & 0xF) << 5) |
           (d.getDate() & 0x1F);
  }

  function baueZip(dateien) {
    if (!Array.isArray(dateien) || !dateien.length) {
      return new Uint8Array(0);
    }
    var jetzt = new Date();
    var tm = dosTime(jetzt), dt = dosDate(jetzt);

    var localChunks = [], centralChunks = [], offset = 0, eintraege = [];

    dateien.forEach(function (f) {
      var data = (typeof f.content === 'string') ? utf8(f.content)
               : f.content instanceof Uint8Array ? f.content
               : utf8(String(f.content || ''));
      var name = utf8(f.name);
      var crc = crc32(data);

      // Local file header (30 Bytes + Filename)
      var lfh = new Uint8Array(30 + name.length);
      var dv = new DataView(lfh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);    // version needed
      dv.setUint16(6, 0, true);     // flags
      dv.setUint16(8, 0, true);     // compression = store
      dv.setUint16(10, tm, true);
      dv.setUint16(12, dt, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lfh.set(name, 30);
      localChunks.push(lfh);
      localChunks.push(data);

      eintraege.push({ offset: offset, crc: crc, size: data.length, name: name });
      offset += lfh.length + data.length;
    });

    var cdSize = 0;
    eintraege.forEach(function (e) {
      var cdh = new Uint8Array(46 + e.name.length);
      var dv = new DataView(cdh.buffer);
      dv.setUint32(0, 0x02014b50, true);
      dv.setUint16(4, 0x031E, true); // version made by (UNIX + 30)
      dv.setUint16(6, 20, true);     // version needed
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, tm, true);
      dv.setUint16(14, dt, true);
      dv.setUint32(16, e.crc, true);
      dv.setUint32(20, e.size, true);
      dv.setUint32(24, e.size, true);
      dv.setUint16(28, e.name.length, true);
      dv.setUint16(30, 0, true);
      dv.setUint16(32, 0, true);
      dv.setUint16(34, 0, true);
      dv.setUint16(36, 0, true);
      dv.setUint32(38, 0, true);
      dv.setUint32(42, e.offset, true);
      cdh.set(e.name, 46);
      centralChunks.push(cdh);
      cdSize += cdh.length;
    });

    var endCD = new Uint8Array(22);
    var ev = new DataView(endCD.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, eintraege.length, true);
    ev.setUint16(10, eintraege.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    var total = offset + cdSize + 22;
    var out = new Uint8Array(total);
    var pos = 0;
    localChunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    centralChunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    out.set(endCD, pos);
    return out;
  }

  return { baueZip: baueZip, crc32: crc32 };
});
