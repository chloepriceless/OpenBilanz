#!/usr/bin/env bash
# ============================================================================
# setup-taxonomie.sh - laedt die amtliche E-Bilanz-Taxonomie herunter
# ----------------------------------------------------------------------------
# Die Taxonomie wird fuer die Validierung der E-Bilanz benoetigt
# (lib/validate.js). Sie ist ~53 MB gross und wird daher NICHT im Repository
# mitgeliefert.
#
# Die amtliche Veroeffentlichung erfolgt durch die Finanzverwaltung; das ZIP
# wird hier von xbrl.de bezogen. Bei einer neuen Taxonomie-Version die URL
# anpassen und public/shared/taxonomie.js abgleichen.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

URL="https://www.xbrl.de/german-gaap-taxonomy-v6.9-2025-04-01.zip"
ZIEL="taxonomie/taxonomy-6.9.zip"

mkdir -p taxonomie
if [ -f "$ZIEL" ]; then
  echo "Taxonomie bereits vorhanden: $ZIEL"
  exit 0
fi

echo "Lade E-Bilanz-Taxonomie 6.9 ..."
if command -v curl >/dev/null 2>&1; then
  curl -fSL -o "$ZIEL" "$URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$ZIEL" "$URL"
else
  echo "FEHLER: weder curl noch wget vorhanden." >&2
  exit 1
fi
echo "Fertig: $ZIEL ($(wc -c < "$ZIEL") Bytes)"
echo "Pruefen der Installation:  python3 -c 'import arelle' && echo Arelle OK"
