#!/usr/bin/env bash
# OpenBilanz starten - oeffnet das Tool im Browser.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "FEHLER: Node.js ist nicht installiert. Bitte Node >= 18 installieren."
  exit 1
fi

PORT="${PORT:-3000}"
# Standardmaessig nur lokal erreichbar (keine Authentifizierung im Tool).
# Fuer bewussten Netzwerk-Zugriff:  HOST=0.0.0.0 ./start.sh
HOST="${HOST:-127.0.0.1}"
echo "OpenBilanz startet auf http://localhost:${PORT}"
echo "Zum Beenden: Strg+C"
PORT="$PORT" HOST="$HOST" node server.js
