# Sicherheitsrichtlinie

OpenBilanz verarbeitet steuerlich und wirtschaftlich sensible Daten. Sicherheit
wird daher ernst genommen — gleichzeitig ist OpenBilanz **Work in Progress** und
wird **ohne Gewähr** bereitgestellt (siehe [Haftungsausschluss im README](README.md)).

## Unterstützte Versionen

OpenBilanz befindet sich in aktiver Entwicklung. Sicherheitskorrekturen fließen
ausschließlich in den **aktuellen Stand des `main`-Branches** bzw. in das
jeweils jüngste Release ein. Ältere Stände werden nicht gepflegt.

## Sicherheitslücke melden

Bitte **keine** öffentlichen GitHub-Issues für Sicherheitslücken anlegen.

Stattdessen vertraulich melden — über einen der beiden Wege:

1. **GitHub Security Advisory** (bevorzugt): im Repository unter
   *Security → Report a vulnerability* eine private Meldung anlegen.
2. **E-Mail:** `info@bikinibottom.capital`

Sinnvolle Angaben: betroffene Datei/Funktion, Schritte zur Reproduktion,
mögliche Auswirkung und — falls vorhanden — ein Vorschlag zur Behebung.
Eine erste Rückmeldung erfolgt in der Regel innerhalb von **14 Tagen**.

## Sicherheitsmodell

OpenBilanz ist bewusst schlank gebaut:

- **Keine npm-Abhängigkeiten.** Der Server nutzt ausschließlich die
  Node-Standardbibliothek — die Angriffsfläche über die Lieferkette
  (Supply Chain) ist dadurch minimal.
- **Daten bleiben lokal.** Im Selbst-Hosting-Modus liegen die Daten als
  JSON-Dateien unter `./data`, im Website-Modus im `IndexedDB` des Browsers.
  Es findet **keine** Übertragung der Buchhaltungsdaten an Dritte statt.
- **Standardbindung nur auf `127.0.0.1`.** Der Server ist von außen nicht
  erreichbar, solange `HOST` nicht ausdrücklich geändert wird.
- **Schutz vor DNS-Rebinding.** Ein lokal gebundener Server beantwortet nur
  Anfragen mit lokalem `Host`-Header.
- **Strenge Content-Security-Policy** in der Anwendung: `default-src 'none'`,
  `connect-src 'self'`, kein Inline-JavaScript.
- **`.obz`-Sicherungen** können mit Passwort verschlüsselt werden
  (PBKDF2 + AES-GCM).

## Netzwerk-Betrieb (`HOST=0.0.0.0`)

> ⚠️ **OpenBilanz hat keine Authentifizierung.**

Wird der Server an eine nicht-lokale Adresse gebunden, kann **jede Person mit
Zugriff auf den Port** die Buchhaltungsdaten lesen und ändern.

Dieser Modus ist deshalb gesperrt, solange er nicht ausdrücklich freigegeben
wird. Er startet **nur**, wenn zusätzlich gesetzt ist:

```bash
HOST=0.0.0.0 OPENBILANZ_UNSAFE_NETWORK=1 node server.js
```

Ohne `OPENBILANZ_UNSAFE_NETWORK=1` bricht der Start mit einem Hinweis ab. Ist
der Netzwerk-Betrieb aktiv, blendet die Oberfläche dauerhaft eine rote
Warnleiste ein. Nutze diesen Modus ausschließlich in einem **vertrauens­würdigen
Netz** — niemals im offenen Internet.

## Bekannte Einschränkungen

- **Keine Benutzerauthentifizierung.** OpenBilanz ist als Einzelplatz-Werkzeug
  konzipiert. Wer den Server erreicht, hat vollen Zugriff.
- **Kein Mehrbenutzerbetrieb** und keine Rechteverwaltung.
- **Work in Progress** — Berechnungen, Schnittstellen und Formate können
  fehlerhaft sein; jeder Abschluss ist vor Abgabe fachkundig zu prüfen.
- Die Git-Historie des Datenordners ist **kein** revisionssicheres Archiv im
  Sinne der GoBD.
