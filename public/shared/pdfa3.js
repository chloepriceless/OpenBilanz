/* ===========================================================================
 * pdfa3.js  -  PDF/A-3-Anhang-Extraktor (ZUGFeRD / Factur-X / XRechnung)
 * ---------------------------------------------------------------------------
 * Liest die in eine ZUGFeRD-PDF eingebetteten Dateien aus dem PDF heraus.
 * Zweck ist ausschließlich: aus der PDF die mitgelieferte E-Rechnungs-XML
 * (factur-x.xml, zugferd-invoice.xml, xrechnung.xml) zu ziehen. Es ist KEIN
 * vollwertiger PDF-Parser.
 *
 *   extractAttachments(buf)  ->  Promise<{ attachments:[{name, bytes, text}] }>
 *
 * Vorgehen — bewusst pragmatisch, ohne vollständigen xref-Walk:
 *   1. PDF-Bytes als Latin-1-String betrachten (byte-genau).
 *   2. Alle Indirect-Object-Blöcke finden.
 *   3. Daraus die Objekte herausfiltern, die ein Dictionary mit
 *      /Type /EmbeddedFile haben (das ist der File-Stream-Eintrag).
 *   4. Den Roh-Stream zwischen `stream\n` und `\nendstream` extrahieren —
 *      Länge anhand /Length aus dem Dictionary, sonst `endstream`-Marker.
 *   5. Bei /Filter /FlateDecode → entpacken (Node: zlib.inflate;
 *      Browser: DecompressionStream('deflate' bzw. 'deflate-raw')).
 *   6. Den Dateinamen aus dem zugehörigen /Filespec-Dictionary auflösen,
 *      indem im gesamten PDF nach `<<...>>` mit `/Type /Filespec` gesucht
 *      und das auf das EmbeddedFile-Objekt zeigende Filespec gewählt wird.
 *      Konnte das nicht aufgelöst werden, wird der Dateiname aus der
 *      vorgefundenen XML heuristisch geraten.
 *
 * Zero-Dependency. Läuft in Node (zlib aus stdlib) und in modernen Browsern
 * (DecompressionStream — Chrome 80+, Firefox 113+, Safari 16.4+).
 *
 * Gibt im Erfolgsfall { attachments: [{ name, bytes: Uint8Array, text }] }
 * zurück, im Fehlerfall { fehler: '...' }.
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pdfa3 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---- Byte/String-Hilfen ---------------------------------------------- */

  /* Eingang in eine Uint8Array kanonisieren. Akzeptiert Uint8Array,
   * ArrayBuffer, Node-Buffer und (für kleine Tests) string mit Latin-1. */
  function toBytes(input) {
    if (!input && input !== '') return new Uint8Array(0);
    if (input instanceof Uint8Array) return input;
    if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
      return new Uint8Array(input);
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (typeof input === 'string') {
      var out = new Uint8Array(input.length);
      for (var i = 0; i < input.length; i++) out[i] = input.charCodeAt(i) & 0xff;
      return out;
    }
    if (input.buffer && typeof input.byteLength === 'number') {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength);
    }
    return new Uint8Array(0);
  }
  /* Latin-1 ist verlustlos für jeden einzelnen Byte-Wert — die ASCII-Struktur
   * (Object-Definitionen, Dictionaries) bleibt lesbar. Echte Binärbereiche
   * (Streams) extrahieren wir später byteweise wieder, nicht aus dem String. */
  function bytesToLatin1(b) {
    var s = '', n = b.length;
    /* fromCharCode in Schüben, damit der Stack nicht überläuft. */
    for (var i = 0; i < n; i += 0x8000) {
      s += String.fromCharCode.apply(null, b.subarray(i, Math.min(i + 0x8000, n)));
    }
    return s;
  }
  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) {}
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
    /* Fallback: byteweise — verliert Multi-Byte-Codepoints, reicht für ASCII-XML. */
    return bytesToLatin1(bytes);
  }
  /* ---- Inflate-Adapter ------------------------------------------------- */

  function inflate(bytes) {
    /* Node: zlib aus stdlib. */
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      var zlib = require('zlib');
      return new Promise(function (resolve, reject) {
        zlib.inflate(Buffer.from(bytes), function (err, out) {
          if (!err) return resolve(new Uint8Array(out));
          /* PDF-Streams sind in der Regel zlib-wrapped, manche aber raw deflate. */
          zlib.inflateRaw(Buffer.from(bytes), function (err2, out2) {
            if (err2) return reject(err2);
            resolve(new Uint8Array(out2));
          });
        });
      });
    }
    /* Browser: DecompressionStream. 'deflate' = zlib-wrapped (RFC 1950),
     * Fallback 'deflate-raw' = roher Deflate-Stream (RFC 1951). */
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Inflate nicht verfügbar (kein DecompressionStream).'));
    }
    function tryFormat(fmt) {
      var ds = new DecompressionStream(fmt);
      var stream = new Response(new Blob([bytes])).body.pipeThrough(ds);
      return new Response(stream).arrayBuffer().then(function (ab) {
        return new Uint8Array(ab);
      });
    }
    return tryFormat('deflate').catch(function () { return tryFormat('deflate-raw'); });
  }

  /* ---- PDF-Mini-Parser ------------------------------------------------- */

  /* Liest aus einem Dictionary-Text (innerhalb von << >>) den Wert hinter
   * /Key. Gibt String zurück (Tokens bis zum nächsten /, Whitespace-Ende,
   * Array-, Dictionary- oder String-Ende). Reicht für die Subset-Suche. */
  function dictValue(dict, key) {
    var re = new RegExp('/' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '\\b\\s*((?:<<[\\s\\S]*?>>|\\[[\\s\\S]*?\\]|\\([^)]*\\)|<[0-9A-Fa-f\\s]*>' +
      '|/[^\\s/<>\\[\\]()]+|-?\\d+\\s+\\d+\\s+R|-?\\d+(?:\\.\\d+)?))');
    var m = re.exec(dict);
    return m ? m[1] : null;
  }
  /* Parst (..)-Stringliteral. Octale Escapes und \-Escapes werden minimal
   * unterstützt. Reicht für ASCII-Dateinamen wie 'factur-x.xml'. */
  function parsePdfString(s) {
    if (s == null) return null;
    s = String(s);
    if (s.charAt(0) === '<') {
      /* Hex-String <48656C6C6F> */
      var hex = s.slice(1, -1).replace(/\s+/g, '');
      if (hex.length % 2) hex += '0';
      var out = '';
      for (var i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      return out;
    }
    if (s.charAt(0) !== '(') return s;
    var body = s.slice(1, -1);
    return body.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, function (_, e) {
      if (e === 'n') return '\n'; if (e === 'r') return '\r'; if (e === 't') return '\t';
      if (e === 'b') return '\b'; if (e === 'f') return '\f';
      if (e === '(' || e === ')' || e === '\\') return e;
      return String.fromCharCode(parseInt(e, 8));
    });
  }
  /* "n g R" → { num: n, gen: g } */
  function parseRef(s) {
    if (!s) return null;
    var m = /^\s*(\d+)\s+(\d+)\s+R\s*$/.exec(s);
    return m ? { num: +m[1], gen: +m[2] } : null;
  }
  /* Top-Level-Dictionary aus dem Object-Body ziehen — balanced << >>, damit
   * eingebettete Sub-Dictionaries (etwa /EF << /F n g R >>) nicht abgeschnitten
   * werden. Sucht das erste << ab from und liefert seinen Inhalt. */
  function extractTopDict(body, from) {
    var start = body.indexOf('<<', from || 0);
    if (start < 0) return null;
    var depth = 0, i = start, n = body.length;
    while (i < n - 1) {
      var c = body.charCodeAt(i), d = body.charCodeAt(i + 1);
      if (c === 0x28) { /* '(' — String, bis ')' überspringen, Escapes beachten */
        i++;
        while (i < n && body.charCodeAt(i) !== 0x29) {
          if (body.charCodeAt(i) === 0x5c && i + 1 < n) i += 2;
          else i++;
        }
        i++; continue;
      }
      if (c === 0x3c && d === 0x3c) { depth++; i += 2; continue; }
      if (c === 0x3e && d === 0x3e) {
        depth--;
        if (depth === 0) return body.slice(start + 2, i);
        i += 2; continue;
      }
      i++;
    }
    return null;
  }
  /* Findet alle Indirect-Objects im PDF-Text. Liefert
   * [{ num, gen, headerEnd, dict (string oder null), streamStart, streamEnd }]
   * — streamStart/streamEnd zeigen in den Byte-Stream, nicht den String. */
  function scanObjects(text /* , bytes */) {
    var out = [];
    var re = /(\d+)\s+(\d+)\s+obj\b/g;
    var m;
    while ((m = re.exec(text))) {
      var num = +m[1], gen = +m[2], headerEnd = re.lastIndex;
      /* endobj danach finden */
      var endRe = /\bendobj\b/g; endRe.lastIndex = headerEnd;
      var endM = endRe.exec(text);
      if (!endM) continue;
      var body = text.slice(headerEnd, endM.index);
      var dict = extractTopDict(body, 0);
      /* Optionaler stream */
      var streamMatch = /\bstream(\r\n|\n|\r)/.exec(body);
      var streamStart = -1, streamEnd = -1;
      if (streamMatch) {
        streamStart = headerEnd + streamMatch.index + streamMatch[0].length;
        /* Suche nach endstream (vorher whitespace tolerieren) */
        var endStreamRe = /[\r\n]?endstream\b/g; endStreamRe.lastIndex = streamStart;
        var es = endStreamRe.exec(text);
        if (es) streamEnd = es.index;
      }
      out.push({ num: num, gen: gen, headerEnd: headerEnd, dict: dict,
                 streamStart: streamStart, streamEnd: streamEnd });
      re.lastIndex = endM.index;
    }
    return out;
  }
  /* ---- Hauptfunktion --------------------------------------------------- */

  function extractAttachments(input) {
    var bytes = toBytes(input);
    if (!bytes.length) {
      return Promise.resolve({ fehler: 'Leere Eingabe.' });
    }
    /* Header prüfen: %PDF-1.x (PDF/A-3 ist auf 1.7 spezifiziert, aber wir
     * lassen 1.x grundsätzlich zu). */
    var head = '';
    for (var i = 0; i < Math.min(8, bytes.length); i++) head += String.fromCharCode(bytes[i]);
    if (head.slice(0, 5) !== '%PDF-') {
      return Promise.resolve({ fehler: 'Keine PDF-Datei (Magic-Bytes fehlen).' });
    }
    var text = bytesToLatin1(bytes);
    var objs = scanObjects(text, bytes);
    /* EmbeddedFile-Objekte: Dictionary enthält /Type /EmbeddedFile */
    var embedded = objs.filter(function (o) {
      return o.dict && /\/Type\s*\/EmbeddedFile\b/.test(o.dict) && o.streamStart >= 0;
    });
    /* Filespec-Objekte: Dictionary enthält /Type /Filespec. Verknüpft Namen
     * mit EmbeddedFile-Referenzen über /EF << /F n g R /UF n g R >>. */
    var filespecs = objs.filter(function (o) {
      return o.dict && /\/Type\s*\/Filespec\b/.test(o.dict);
    });
    var nameByEmbeddedNum = {};
    filespecs.forEach(function (fs) {
      var ef = dictValue(fs.dict, 'EF');
      if (!ef) return;
      var efInner = /<<([\s\S]*?)>>/.exec(ef);
      if (!efInner) return;
      var refStr = dictValue(efInner[1], 'F') || dictValue(efInner[1], 'UF');
      var ref = parseRef(refStr);
      if (!ref) return;
      var nm = parsePdfString(dictValue(fs.dict, 'UF') || dictValue(fs.dict, 'F') || '');
      if (nm) nameByEmbeddedNum[ref.num] = nm;
    });

    var promises = embedded.map(function (o) {
      var raw = bytes.subarray(o.streamStart, o.streamEnd);
      /* /Length präzise nutzen, falls direkt im Dictionary. Sonst nehmen wir
       * den ganzen Bereich bis endstream und lassen ein evtl. trailing
       * \r\n stehen — inflate ist robust gegenüber Padding-Müll am Ende
       * nicht; daher schneiden wir Whitespace am Stream-Ende ab. */
      var len = dictValue(o.dict, 'Length');
      var streamBytes = raw;
      if (len && /^\d+$/.test(len.trim())) {
        var n = parseInt(len.trim(), 10);
        if (n <= raw.length) streamBytes = raw.subarray(0, n);
      } else {
        /* Trailing whitespace abschneiden */
        var end = streamBytes.length;
        while (end > 0 && (streamBytes[end - 1] === 0x0a || streamBytes[end - 1] === 0x0d
                            || streamBytes[end - 1] === 0x20)) end--;
        streamBytes = streamBytes.subarray(0, end);
      }
      var filter = dictValue(o.dict, 'Filter') || '';
      var needsInflate = /FlateDecode/.test(filter);
      var pBytes = needsInflate ? inflate(streamBytes)
                                : Promise.resolve(streamBytes);
      return pBytes.then(function (decoded) {
        var nm = nameByEmbeddedNum[o.num] || '';
        var txt = utf8Decode(decoded);
        if (!nm) {
          /* Heuristisch raten anhand des Inhalts. */
          if (/CrossIndustryInvoice/i.test(txt)) nm = 'factur-x.xml';
          else if (/<Invoice\b|<CreditNote\b/i.test(txt)) nm = 'xrechnung.xml';
          else nm = 'anhang.bin';
        }
        return { name: nm, bytes: decoded, text: txt };
      }, function (err) {
        return { name: nameByEmbeddedNum[o.num] || 'anhang.bin', bytes: null,
                 text: '', fehler: String(err && err.message || err) };
      });
    });

    return Promise.all(promises).then(function (atts) {
      var ok = atts.filter(function (a) { return !a.fehler && a.text; });
      if (!atts.length) {
        return { attachments: [],
          fehler: 'PDF enthält keinen EmbeddedFile-Anhang. Ist es eine ZUGFeRD-/Factur-X-PDF?' };
      }
      if (!ok.length) {
        return { attachments: atts,
          fehler: 'PDF-Anhänge konnten nicht entpackt werden.' };
      }
      return { attachments: ok };
    });
  }

  return { extractAttachments: extractAttachments,
           /* exportiert für Tests */
           _toBytes: toBytes, _bytesToLatin1: bytesToLatin1, _inflate: inflate };
});
