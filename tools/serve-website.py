#!/usr/bin/env python3
"""
serve-website.py  -  Lokaler HTTPS-Server fuer die Website-Variante von OpenBilanz

Liefert den Ordner public/ statisch ueber HTTPS aus (Website-Modus: alle Daten
bleiben im Browser, keine serverseitige Verarbeitung). HTTPS ist noetig, damit
WebCrypto (.obz-Verschluesselung) und der Service Worker auch ueber andere
Adressen als localhost funktionieren - diese Browser-APIs verlangen einen
"sicheren Kontext".

Beim ersten Start wird unter tools/.devcert/ ein selbstsigniertes
Entwickler-Zertifikat erzeugt; der Browser zeigt dafuer einmal eine
Sicherheitswarnung, die bestaetigt werden muss. Fuer den oeffentlichen Betrieb
ist stattdessen ein echtes Zertifikat zu verwenden (z. B. Let's Encrypt).

Aufruf:  python3 tools/serve-website.py [port]      (Standard-Port: 8000)
"""
import functools
import http.server
import os
import ssl
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
CERTDIR = os.path.join(ROOT, 'tools', '.devcert')
CERT = os.path.join(CERTDIR, 'cert.pem')
KEY = os.path.join(CERTDIR, 'key.pem')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


def zertifikat_sichern():
    """Erzeugt bei Bedarf ein selbstsigniertes Entwickler-Zertifikat."""
    if os.path.exists(CERT) and os.path.exists(KEY):
        return
    os.makedirs(CERTDIR, exist_ok=True)
    print('Erzeuge selbstsigniertes Entwickler-Zertifikat ...')
    subprocess.check_call([
        'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', KEY, '-out', CERT, '-days', '825',
        '-subj', '/CN=localhost',
        '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ])


class Handler(http.server.SimpleHTTPRequestHandler):
    """Statischer Datei-Handler. Unterbindet Browser-Caching, damit beim
    Entwickeln/Testen stets der aktuelle Stand ausgeliefert wird."""
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()


def main():
    if not os.path.isdir(PUBLIC):
        sys.exit('Ordner public/ nicht gefunden.')
    zertifikat_sichern()

    # .webmanifest und .wasm korrekt ausliefern (WebAssembly braucht den MIME-Typ)
    Handler.extensions_map['.webmanifest'] = 'application/manifest+json'
    Handler.extensions_map['.wasm'] = 'application/wasm'

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    handler = functools.partial(Handler, directory=PUBLIC)
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), handler)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    print('')
    print('  OpenBilanz (Website-Modus) laeuft ueber HTTPS.')
    print('  Im Browser oeffnen:  https://localhost:%d' % PORT)
    print('  Selbstsigniertes Zertifikat - die Browser-Warnung einmal bestaetigen.')
    print('  Beenden mit Strg+C')
    print('')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer beendet.')


if __name__ == '__main__':
    main()
