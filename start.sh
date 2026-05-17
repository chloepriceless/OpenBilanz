#!/usr/bin/env bash
# OpenBilanz starten - oeffnet das Tool im Browser.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "FEHLER: Node.js ist nicht installiert. Bitte Node >= 18 installieren."
  exit 1
fi

PORT="${PORT:-3000}"
echo "OpenBilanz startet auf http://localhost:${PORT}"
echo "Zum Beenden: Strg+C"
PORT="$PORT" node server.js
