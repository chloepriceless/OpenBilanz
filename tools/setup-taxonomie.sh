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
# Plausibilitaetspruefung: muss ein ZIP sein (Magic 'PK') und hinreichend gross
# - faengt z. B. eine versehentlich gespeicherte Fehler-/Weiterleitungsseite ab.
if [ "$(head -c2 "$ZIEL" 2>/dev/null)" != "PK" ] || [ "$(wc -c < "$ZIEL")" -lt 1000000 ]; then
  echo "FEHLER: Download ist kein gueltiges Taxonomie-ZIP (Format/Groesse)." >&2
  rm -f "$ZIEL"
  exit 1
fi

# Integritaets-Verifikation per SHA-256. Eine erwartete Pruefsumme kann ueber die
# Umgebungsvariable TAXONOMIE_SHA256 ODER eine Datei "<ZIEL>.sha256" hinterlegt
# werden (Format: "<hash>  <dateiname>" wie von sha256sum erzeugt). Ist eine
# erwartete Summe gesetzt und weicht ab -> Abbruch. Ist keine gesetzt, wird die
# berechnete Summe ausgegeben, damit sie nach einer vertrauenswuerdigen
# Erstinstallation gepinnt werden kann (trust-on-first-use; der Download selbst
# laeuft bereits ueber TLS gegen xbrl.de).
ERWARTET="${TAXONOMIE_SHA256:-}"
[ -z "$ERWARTET" ] && [ -f "$ZIEL.sha256" ] && ERWARTET="$(awk '{print $1}' "$ZIEL.sha256" | head -n1)"
if command -v sha256sum >/dev/null 2>&1; then SHA="$(sha256sum "$ZIEL" | awk '{print $1}')";
elif command -v shasum   >/dev/null 2>&1; then SHA="$(shasum -a 256 "$ZIEL" | awk '{print $1}')";
else SHA=""; echo "WARNUNG: weder sha256sum noch shasum vorhanden - keine Pruefsummen-Verifikation." >&2; fi
if [ -n "$ERWARTET" ] && [ -n "$SHA" ]; then
  if [ "$SHA" != "$ERWARTET" ]; then
    echo "FEHLER: SHA-256 stimmt nicht ueberein." >&2
    echo "  erwartet:  $ERWARTET" >&2
    echo "  berechnet: $SHA" >&2
    rm -f "$ZIEL"
    exit 1
  fi
  echo "SHA-256 verifiziert: $SHA"
elif [ -n "$SHA" ]; then
  echo "SHA-256 (zum Pinnen via TAXONOMIE_SHA256 oder $ZIEL.sha256): $SHA"
fi

echo "Fertig: $ZIEL ($(wc -c < "$ZIEL") Bytes)"
echo "Pruefen der Installation:  python3 -c 'import arelle' && echo Arelle OK"
