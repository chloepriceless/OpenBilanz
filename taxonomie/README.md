# Ordner `taxonomie/`

Hier gehoert das amtliche **E-Bilanz-Taxonomie-Paket** hinein (ZIP, ca. 53 MB).
Es wird fuer die Validierung der erzeugten E-Bilanz benoetigt
(`lib/validate.js`) und ist wegen seiner Groesse **nicht** im Repository
enthalten.

## Beschaffung

```bash
./tools/setup-taxonomie.sh
```

Das Skript laedt `german-gaap-taxonomy-v6.9-2025-04-01.zip` herunter und legt
es als `taxonomie/taxonomy-6.9.zip` ab.

Alternativ das ZIP manuell von **https://www.esteuer.de** bzw.
**https://de.xbrl.org/taxonomien/** herunterladen und hier ablegen.

## Validierung nutzen

Voraussetzung ist ausserdem der XBRL-Validator **Arelle**:

```bash
pip install arelle-release
```

Danach prueft das Tool die E-Bilanz auf Knopfdruck (E-Bilanz-Ansicht) oder
ueber die Kommandozeile:

```bash
node lib/validate.js pfad/zur/xbrl-instanz.xml
```

## Versionswechsel

Veroeffentlicht die Finanzverwaltung eine neue Taxonomie-Version, sind
anzupassen: die URL in `tools/setup-taxonomie.sh` sowie `STAND`/`VERSION` und
die Element-Namen in `public/shared/taxonomie.js`.
