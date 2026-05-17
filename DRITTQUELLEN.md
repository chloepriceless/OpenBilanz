# Drittquellen und Lizenzlage

Dieses Dokument legt offen, woher Daten und Wissen stammen, das in
OpenBilanz eingeflossen ist &ndash; und warum die MIT-Lizenz
unproblematisch ist.

## Eigenleistung

Der **gesamte Quellcode** (Server, Frontend, Rechenkern, XBRL-Erzeugung,
Validierung, Tests) wurde fuer dieses Projekt original erstellt. Es wurde kein
Code aus anderen Projekten uebernommen.

## Verwendete Fakten und amtliche Werke (nicht urheberrechtlich geschuetzt)

| Inhalt | Herkunft | Rechtslage |
|---|---|---|
| Kontenrahmen SKR04 (Kontonummern und Bezeichnungen) | amtlich publizierter DATEV-Standardkontenrahmen | Tatsachen / Kontenplan; die hier getroffene Auswahl und das HGB-Mapping sind Eigenleistung |
| HGB-, GmbHG-, EStG- (insb. § 5b EStG &ndash; Rechtsgrundlage der E-Bilanz), GewStG-, KStG-Paragraphen | gesetze-im-internet.de | Amtliche Werke, § 5 UrhG &ndash; kein Urheberrechtsschutz |
| E-Bilanz-Taxonomie 6.9 (Elementnamen `de-gaap-ci` / `de-gcd`) | amtliche Kerntaxonomie 6.9 der Finanzverwaltung (esteuer.de; BMF-Schreiben vom 10.06.2025) | Amtliche Spezifikation; nur die Elementnamen werden verwendet, um konformes XBRL zu erzeugen |
| ELSTER-`EBilanz`-Container-Struktur | amtliches ELSTER-XML-Schema | Amtliche Spezifikation |

Das **Taxonomie-Paket selbst** (ca. 53 MB) ist **nicht** Teil des Repositorys
(siehe `taxonomie/README.md`); es wird vom Nutzer von esteuer.de / xbrl.de
geladen.

## Nur als Referenz herangezogen (kein Code, keine Datei uebernommen)

| Projekt | Lizenz | Nutzung |
|---|---|---|
| [quambene/taxel](https://github.com/quambene/taxel) | AGPL-3.0 | Referenz fuer den Aufbau des ELSTER-`EBilanz`-Containers. Es wurde **kein** Code/keine Datei uebernommen. |
| [alyf-de/SKR04](https://github.com/alyf-de/SKR04) | GPL-3.0 | Plausibilitaetspruefung des eigenen SKR04-zu-HGB-Mappings. Es wurde **kein** Code/keine Datei uebernommen. |
| [laroche/trading-gmbh](https://github.com/laroche/trading-gmbh) | CC0-1.0 (gemeinfrei) | Abgleich der Konten fuer die vermoegensverwaltende GmbH. CC0 erlaubt jede Nutzung. |
| [scka-de/german-accounting](https://github.com/scka-de/german-accounting) | MIT | Maschinenlesbarer SKR03-/SKR04-Datensatz; zum Gegenpruefen des eigenen Kontenrahmens. Es wurde **kein** Code/keine Datei uebernommen. |

Da aus den GPL-/AGPL-Projekten **weder Quellcode noch Datendateien** in dieses
Repository uebernommen wurden, entstehen daraus **keine Copyleft-Pflichten**.

## Externe Werkzeuge (Laufzeit, nicht gebuendelt)

| Werkzeug | Lizenz | Zweck |
|---|---|---|
| [Arelle](https://arelle.org) | Apache-2.0 | Optional: XBRL-Validierung gegen die Taxonomie. Wird separat per `pip` installiert, ist nicht im Repo enthalten. |
| Node.js | MIT u. a. | Laufzeitumgebung |

## Fazit

Das Repository enthaelt ausschliesslich Eigenleistung sowie Tatsachen und
amtliche Werke. Die Veroeffentlichung unter der **MIT-Lizenz** ist daher
rechtlich unproblematisch.
