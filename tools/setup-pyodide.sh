#!/usr/bin/env bash
# ===========================================================================
# setup-pyodide.sh  -  laedt Pyodide + Arelle fuer die Browser-Validierung
# ---------------------------------------------------------------------------
# EXPERIMENTELL (siehe ROADMAP, Abschnitt 2). Stellt die vollstaendige
# E-Bilanz-Validierung gegen die amtliche Taxonomie rein im Browser bereit -
# ohne Server, ohne Datenabfluss. Die Assets landen in public/pyodide/ und
# public/wheels/ (beide gitignored); zusammen mehrere hundert MB, einmalig.
#
# Voraussetzungen: curl, tar (bzip2), python3 mit pip.
# Aufruf:  ./tools/setup-pyodide.sh
# ===========================================================================
set -eu

PYODIDE_VERSION="0.29.4"
ARELLE_VERSION="2.41.0"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYODIDE_DIR="$ROOT/public/pyodide"
WHEELS_DIR="$ROOT/public/wheels"
TAX_DIR="$ROOT/public/taxonomie"

echo ""
echo "  OpenBilanz - Pyodide/Arelle-Setup (experimentell)"
echo ""

# --- 1. Pyodide-Laufzeit + Python-Pakete -----------------------------------
if [ -f "$PYODIDE_DIR/pyodide.js" ]; then
  echo "  Pyodide bereits vorhanden - uebersprungen."
else
  mkdir -p "$PYODIDE_DIR"
  TARBALL="pyodide-$PYODIDE_VERSION.tar.bz2"
  URL="https://github.com/pyodide/pyodide/releases/download/$PYODIDE_VERSION/$TARBALL"
  echo "  Lade Pyodide $PYODIDE_VERSION (mehrere hundert MB) ..."
  curl -L --fail -o "/tmp/$TARBALL" "$URL"
  echo "  Entpacke ..."
  tar -xjf "/tmp/$TARBALL" -C /tmp
  cp -r /tmp/pyodide/. "$PYODIDE_DIR/"
  rm -rf "/tmp/$TARBALL" /tmp/pyodide
  echo "  Pyodide -> public/pyodide/"
fi
echo ""

# --- 2. Arelle + reine Python-Abhaengigkeiten (Wheels) ---------------------
echo "  Lade Arelle $ARELLE_VERSION und Abhaengigkeiten ..."
mkdir -p "$WHEELS_DIR"
python3 -m pip download --no-deps --only-binary=:all: --dest "$WHEELS_DIR" \
  "arelle-release==$ARELLE_VERSION" isodate bottle jaconv truststore filelock \
  openpyxl et-xmlfile
# Native GUI-Bibliotheken aus dem Arelle-Wheel entfernen (TkTable o. ae.):
# reine Linux/Mac/Windows-Binaries, die Pyodide nicht laden kann und die fuer
# die kopflose Validierung nicht gebraucht werden.
python3 - "$WHEELS_DIR" <<'PY'
import zipfile, glob, os, sys
wd = sys.argv[1]
treffer = glob.glob(os.path.join(wd, 'arelle_release-*.whl'))
if treffer:
    src = treffer[0]; tmp = src + '.tmp'
    def strip(n): return n.startswith('arelle/resources/libs/')
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for it in zin.infolist():
            if strip(it.filename):
                continue
            data = zin.read(it.filename)
            if it.filename.endswith('.dist-info/RECORD'):
                lines = [l for l in data.decode('utf-8').splitlines()
                         if l and not strip(l.split(',')[0])]
                data = ('\n'.join(lines) + '\n').encode('utf-8')
            zout.writestr(it, data)
    os.replace(tmp, src)
    print('  Arelle-Wheel bereinigt (native GUI-Bibliotheken entfernt)')
PY
# Manifest fuer den Web-Worker (Liste der .whl-Dateien)
python3 -c "import json, glob, os; os.chdir('$WHEELS_DIR'); \
open('wheels.json','w').write(json.dumps(sorted(glob.glob('*.whl'))))"
echo "  Wheels -> public/wheels/"
echo ""

# --- 3. Amtliche Taxonomie -------------------------------------------------
mkdir -p "$TAX_DIR"
if [ -f "$TAX_DIR/taxonomie.zip" ]; then
  echo "  Taxonomie bereits vorhanden."
else
  FOUND="$(ls "$ROOT"/taxonomie/*.zip 2>/dev/null | head -n1 || true)"
  if [ -n "$FOUND" ]; then
    cp "$FOUND" "$TAX_DIR/taxonomie.zip"
    echo "  Taxonomie uebernommen -> public/taxonomie/taxonomie.zip"
  else
    echo "  HINWEIS: keine Taxonomie gefunden. Zuerst ./tools/setup-taxonomie.sh"
    echo "  ausfuehren, dann dieses Skript erneut starten - oder das amtliche"
    echo "  ZIP manuell als public/taxonomie/taxonomie.zip ablegen."
  fi
fi
echo ""
echo "  Fertig. Die vollstaendige Taxonomie-Pruefung (Arelle) steht nun"
echo "  experimentell in der E-Bilanz-Ansicht des Website-Modus bereit."
echo ""
