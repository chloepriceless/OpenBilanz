#!/usr/bin/env bash
# ===========================================================================
# setup-pdf-lib.sh  -  laedt pdf-lib + sRGB-ICC + freie Schrift fuer ZUGFeRD
# ---------------------------------------------------------------------------
# Stellt die Bausteine bereit, mit denen OpenBilanz ZUGFeRD-/Factur-X-PDFs
# (PDF mit eingebetteter CII-XML) im Browser erzeugen kann. Die Assets landen
# in public/vendor/ und werden NICHT zur Laufzeit aus dem Netz nachgeladen.
#
# Geladen wird:
#   - pdf-lib (MIT, ca. 1 MB unminified / 300 KB gzipped)
#   - sRGB-IEC61966-2.1 ICC-Profil (Public Domain, ca. 3 KB)
#   - Liberation Sans (SIL-OFL, freie Schrift, ca. 200 KB pro Schnitt)
#
# Voraussetzungen: curl, tar, sha256sum (oder shasum -a 256).
# Aufruf:  ./tools/setup-pdf-lib.sh
# ===========================================================================
set -eu

PDFLIB_VERSION="1.17.1"
# SHA-256 des erwarteten Downloads (Supply-Chain-Schutz gegen kompromittiertes CDN/MITM).
# Verifiziert gegen den gepinnten npm-Stand pdf-lib@1.17.1 (dist/pdf-lib.min.js, byte-identisch).
PDFLIB_SHA256="0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT/public/vendor"

mkdir -p "$VENDOR_DIR"

# Hash-Plausibilitaet, plattformunabhaengig
sha256() {
  if command -v sha256sum > /dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

echo ""
echo "  OpenBilanz - pdf-lib + ICC + Schrift fuer ZUGFeRD-Hybrid-PDF"
echo ""

# --- 1. pdf-lib (MIT) ------------------------------------------------------
PDFLIB_JS="$VENDOR_DIR/pdf-lib.min.js"
if [ -f "$PDFLIB_JS" ]; then
  echo "  pdf-lib bereits vorhanden — uebersprungen."
else
  echo "  Lade pdf-lib $PDFLIB_VERSION ..."
  curl -L --fail -o "$PDFLIB_JS" \
    "https://unpkg.com/pdf-lib@$PDFLIB_VERSION/dist/pdf-lib.min.js"
  size=$(wc -c < "$PDFLIB_JS")
  if [ "$size" -lt 100000 ]; then
    echo "  FEHLER: pdf-lib.min.js ist verdaechtig klein ($size Byte)." >&2
    rm -f "$PDFLIB_JS"; exit 1
  fi
  got=$(sha256 "$PDFLIB_JS")
  if [ "$got" != "$PDFLIB_SHA256" ]; then
    echo "  FEHLER: SHA-256 von pdf-lib.min.js stimmt nicht (Supply-Chain-Schutz)." >&2
    echo "    erwartet: $PDFLIB_SHA256" >&2
    echo "    erhalten: $got" >&2
    rm -f "$PDFLIB_JS"; exit 1
  fi
  echo "  pdf-lib geladen + SHA-256 verifiziert ($(($size / 1024)) KB)."
fi

# --- 2. sRGB-ICC-Profil (Public Domain) ------------------------------------
ICC_FILE="$VENDOR_DIR/sRGB.icc"
if [ -f "$ICC_FILE" ]; then
  echo "  sRGB-ICC bereits vorhanden — uebersprungen."
else
  echo "  Lade sRGB IEC61966-2.1 ICC-Profil ..."
  curl -L --fail -o "$ICC_FILE" \
    "https://github.com/saucecontrol/Compact-ICC-Profiles/raw/refs/heads/master/profiles/sRGB-v2-micro.icc"
  size=$(wc -c < "$ICC_FILE")
  if [ "$size" -lt 200 ] || [ "$size" -gt 200000 ]; then
    echo "  FEHLER: sRGB.icc Groesse plausibilitaets-untauglich ($size Byte)." >&2
    rm -f "$ICC_FILE"; exit 1
  fi
  echo "  sRGB ICC geladen ($size Byte)."
fi

# --- 3. Freie Schrift (Liberation Sans, SIL-OFL) ---------------------------
# Unter src/ im Repo liegen nur die Font-Quellen (raw/main/src/*.ttf = 404,
# Issue #2). Gebaute TTFs gibt es nur im Release-Tarball; der wird wie pdf-lib
# per SHA-256 gepinnt. Link aus den Release-Notes:
# https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5
FONT_FILE="$VENDOR_DIR/LiberationSans-Regular.ttf"
FONT_BOLD="$VENDOR_DIR/LiberationSans-Bold.ttf"
LIB_VERSION="2.1.5"
LIB_TGZ_URL="https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-$LIB_VERSION.tar.gz"
LIB_TGZ_SHA256="7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0"
FONT_LIZENZ="$VENDOR_DIR/LiberationSans-LICENSE.txt"
LIB_DIR="liberation-fonts-ttf-$LIB_VERSION"
# Laedt den Release-Tarball nach $LIB_TMP und prueft den SHA-256-Pin.
# Rueckgabe: 0 = ok, 1 = Download fehlgeschlagen. Ein falscher Hash bricht
# immer ab (Supply-Chain-Schutz). Explizite Returns, weil set -e in einer
# Funktion im if-Kontext nicht greift.
lade_liberation() {
  LIB_TMP="$(mktemp -d)"
  trap 'rm -rf "$LIB_TMP"' EXIT
  curl -L --fail -o "$LIB_TMP/fonts.tar.gz" "$LIB_TGZ_URL" || return 1
  got=$(sha256 "$LIB_TMP/fonts.tar.gz")
  if [ "$got" != "$LIB_TGZ_SHA256" ]; then
    echo "  FEHLER: SHA-256 des Liberation-Tarballs stimmt nicht (Supply-Chain-Schutz)." >&2
    echo "    erwartet: $LIB_TGZ_SHA256" >&2
    echo "    erhalten: $got" >&2
    exit 1
  fi
  tar -xzf "$LIB_TMP/fonts.tar.gz" -C "$LIB_TMP" \
    "$LIB_DIR/LiberationSans-Regular.ttf" "$LIB_DIR/LiberationSans-Bold.ttf" "$LIB_DIR/LICENSE" ||
    return 1
}
if [ -f "$FONT_FILE" ] && [ -f "$FONT_BOLD" ] && [ -f "$FONT_LIZENZ" ]; then
  echo "  Liberation Sans bereits vorhanden — uebersprungen."
elif [ -f "$FONT_FILE" ] && [ -f "$FONT_BOLD" ]; then
  # Schriften da (Alt-Installation oder von Hand abgelegt), nur der OFL-Volltext
  # fehlt: nur die Lizenz nachladen, vorhandene TTFs nicht anfassen. Ohne Netz
  # kein Abbruch - die Schriften funktionieren, es fehlt nur der Volltext.
  echo "  Liberation Sans vorhanden, OFL-Lizenztext fehlt — lade nach ..."
  if lade_liberation; then
    cp "$LIB_TMP/$LIB_DIR/LICENSE" "$FONT_LIZENZ"
    echo "  OFL-Lizenztext abgelegt (SHA-256 verifiziert)."
  else
    echo "  WARNUNG: Download fehlgeschlagen — $FONT_LIZENZ fehlt weiter." >&2
    echo "    Die OFL verlangt den Lizenztext neben der Schrift; spaeter erneut ausfuehren." >&2
  fi
else
  echo "  Lade Liberation Sans $LIB_VERSION (SIL-OFL) ..."
  lade_liberation || { echo "  FEHLER: Download von $LIB_TGZ_URL fehlgeschlagen." >&2; exit 1; }
  cp "$LIB_TMP/$LIB_DIR/LiberationSans-Regular.ttf" "$FONT_FILE"
  cp "$LIB_TMP/$LIB_DIR/LiberationSans-Bold.ttf" "$FONT_BOLD"
  # Die OFL verlangt, dass die Lizenz die Schrift begleitet.
  cp "$LIB_TMP/$LIB_DIR/LICENSE" "$FONT_LIZENZ"
  echo "  Liberation Sans geladen + SHA-256 verifiziert."
fi

# --- 4. Lizenzhinweise mit ablegen -----------------------------------------
cat > "$VENDOR_DIR/LIZENZEN.md" <<'EOF'
# Drittquellen in public/vendor/

Dieses Verzeichnis enthaelt extern gepflegte Assets, die fuer die ZUGFeRD-PDF-
Erzeugung benoetigt werden. Sie werden lokal bereitgestellt (nicht zur Laufzeit
aus dem Netz nachgeladen) - das ist Kernprinzip der OpenBilanz-Architektur.

## pdf-lib.min.js
- Lizenz: MIT
- Quelle: https://github.com/Hopding/pdf-lib

## sRGB.icc
- Lizenz: Public Domain / freie Verwendung (kompakte sRGB-Variante)
- Quelle: https://github.com/saucecontrol/Compact-ICC-Profiles

## LiberationSans-*.ttf
- Lizenz: SIL Open Font License 1.1 (Volltext: LiberationSans-LICENSE.txt)
- Quelle: https://github.com/liberationfonts/liberation-fonts (Release 2.1.5)
EOF

echo ""
echo "  Fertig. Assets liegen in public/vendor/:"
ls -la "$VENDOR_DIR"
echo ""
echo "  Hinweis: index.html laedt pdf-lib.min.js erst, wenn der Knopf"
echo "  'ZUGFeRD-PDF herunterladen' im Rechnungs-Editor angeklickt wird"
echo "  (lazy load), damit der Erstaufruf von OpenBilanz schlank bleibt."
echo ""
