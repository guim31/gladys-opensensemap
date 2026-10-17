# openSenseMap

Die Messwerte der Bürgersensor-Boxen von
[openSenseMap](https://opensensemap.org) (senseBox, airRohr und eigene
Boxen): deine eigene Box oder die öffentlichen Boxen rund um dein Zuhause.

Diese Integration ist nicht mit openSenseMap, openSenseLab oder senseBox
verbunden.

## Was die Integration macht

- Liest **öffentliche openSenseMap-Boxen** über ihre ID, ohne Konto und ohne
  Schlüssel.
- Legt **ein Gerät pro Box** an, mit einer Funktion pro Sensor, den sie kennt:
  Temperatur, Luftfeuchtigkeit, Luftdruck, PM2.5, PM10, PM1, CO2, VOC, Lärm,
  Helligkeit, UV-Index, Windgeschwindigkeit, Regenintensität, Bodenfeuchte und
  Bodentemperatur.
- Zeigt, wie alt die letzte Messung jeder Box ist: eine stumme Box wird
  gemeldet, ihre alten Werte werden nicht erneut gesendet.
- Fügt das Dashboard-Widget **Messwerte einer Box** hinzu, die zwei
  Szenen-Auslöser **Box offline** und **Box wieder online** und die
  Szenen-Aktion **Messwerte einer Box abrufen**.

Nur lesend: die Integration ändert nie etwas an einer Box.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer.
- Internetzugang (die öffentliche API von openSenseMap).
- Für die Suche um ein Haus: der Standort deines Hauses, unter **Einstellungen
  → Häuser**. Die Integration fragt bei der Installation nach dem Zugriff auf
  die Koordinaten des Hauses; sie nutzt sie nur für diese Suche.

## Konfiguration

### Boxen auswählen

Jede Box hat eine ID aus 24 Zeichen, die in ihrer Adresse auf der Karte steht:
`https://opensensemap.org/explore/5cd81adfff898b001ae7c4c6`. Zwei Wege, sie zu
finden:

1. Klicke auf **Boxen um ein Haus finden**, wähle das Haus und einen Radius:
   das Ergebnis listet die Boxen, die in den letzten 24 Stunden gemessen haben,
   die nächste zuerst, mit Entfernung und Messgrößen. Kopiere die gewünschten
   IDs.
2. Oder öffne die [Karte](https://opensensemap.org), klicke auf eine Box und
   kopiere das Ende der Adresse (der ganze Link wird auch akzeptiert).

Füge die IDs in **Box-IDs** ein, durch Kommas getrennt (höchstens 20 Boxen),
und speichere. Die Boxen erscheinen dann im Tab **Entdecken** der Integration:
füge die gewünschten zu Gladys hinzu.

### Weitere Einstellungen

- **Abruf**: standardmäßig alle 5 Minuten (auf Wunsch 10, 15 oder 30 Minuten).
  openSenseMap ist ein kostenloser Dienst eines gemeinnützigen Vereins:
  höchstens alle 5 Minuten.
- **Sprache**: die Sprache der Funktionsnamen (beim Hinzufügen eines Geräts
  festgelegt) und der Szenentexte. Standardmäßig Französisch.

**Boxen prüfen** liest sofort alle Boxen und meldet für jede, wie alt ihre
letzte Messung ist, welche Messgrößen veröffentlicht und welche Sensoren
ausgelassen werden.

## Geräte

Ein Gerät pro Box, nach der Box benannt (`Saint-Simon Station (openSenseMap)`).
Seine Funktionen sind die Sensoren der Box, die die Integration kennt:

| Messgröße           | Einheit in Gladys | Hinweise                                  |
| ------------------- | ----------------- | ----------------------------------------- |
| Temperatur          | °C                |                                           |
| Luftfeuchtigkeit    | %                 |                                           |
| Luftdruck           | hPa               | bei Bedarf aus Pa umgerechnet             |
| PM2.5, PM10, PM1    | µg/m³             | PM1 ist eine PM2.5-Funktion namens „PM1“  |
| CO2                 | ppm               |                                           |
| VOC                 | ppb               | nur wenn die Box ppb sendet               |
| Lärm                | dB                |                                           |
| Helligkeit          | lx                |                                           |
| UV-Index            | UV-Index          | nur ein echter UV-Index, keine µW/cm²     |
| Windgeschwindigkeit | km/h              | bei Bedarf aus m/s umgerechnet; auch Böen |
| Regenintensität     | mm/h              |                                           |
| Bodenfeuchte        | %                 |                                           |
| Bodentemperatur     | °C                |                                           |
| Alter der Messung   | Minuten           | seit der letzten Messung der Box          |

Die Besitzer benennen ihre Sensoren frei („Temperatur“, „Temp ~ Air“, „CO₂“…):
die Integration erkennt eine Messgröße an ihrer Einheit und ihrem Titel. Misst
eine Box dieselbe Größe zweimal, trägt die zweite Funktion den Titel des
Besitzers, zum Beispiel „Temperatur (Lufttemperatur)“.

Ein Wert wird veröffentlicht, solange er jünger als **eine Stunde** ist.
Danach wird die Box als offline angezeigt und nur das **Alter der Messung**
läuft weiter.

## Widget

**Messwerte einer Box**: mit einer in den Einstellungen gewählten Box bis zu
sechs Live-Kacheln (eine pro Messgröße) und die Zeit der letzten Messung, rot,
wenn die Box offline ist. Ohne Box: eine Zeile pro Box, mit dem Alter ihrer
letzten Messung.

## Szenen

### Auslöser: Box offline

Wird einmal ausgelöst, wenn eine Box seit der gewählten Dauer nichts gesendet
hat: 1, 3, 6, 12, 24 oder 48 Stunden. Lass **Box** leer, um alle Boxen zu
überwachen. Variablen: der Name der Box, die Minuten ohne Messung, die Zeit der
letzten Messung (UTC).

Die Integration meldet eine Box erst nach einer erfolgreichen Antwort von
openSenseMap als offline: ein Ausfall des Dienstes ist keine Box, die offline
geht. Eine Box, die beim Hinzufügen schon stumm ist, löst nichts aus.

### Auslöser: Box wieder online

Wird ausgelöst, wenn eine als offline gemeldete Box wieder misst. Variablen:
der Name der Box und wie viele Minuten sie stumm war.

### Aktion: Messwerte einer Box abrufen

Gibt die letzten Werte einer Box an die folgenden Aktionen weiter: eine fertige
**Zusammenfassung** („Saint-Simon Station (openSenseMap): Temperatur 17,8 °C ·
Luftfeuchtigkeit 99,9 % · vor 3 Min.“), das **Alter** der Messung in Minuten,
und Temperatur, Luftfeuchtigkeit, Luftdruck, PM2.5 und PM10, wenn die Box sie
misst und sie aktuell sind.

## Szenenbeispiele

- **Melde mir, wenn meine Box ausfällt**: Auslöser **Box offline**, Box „Meine
  senseBox“, 6 Stunden → Nachricht senden „Meine senseBox hat seit 6 Stunden
  nichts gesendet: prüfe Strom und WLAN.“
- **Morgenbericht**: jeden Tag um 7:00 → **Messwerte einer Box abrufen** →
  Nachricht `{{summary}}` senden.
- **Raum lüften**: wenn die Funktion **CO2** einer Innenbox über 1.200 ppm
  steigt → Benachrichtigung „Klassenzimmer lüften“ senden.

## Fehlerbehebung

- **Kein Gerät im Tab Entdecken**: prüfe die IDs mit **Boxen prüfen**. „Keine
  solche Box auf openSenseMap“ bedeutet eine falsche ID.
- **Eine Box zeigt keinen Wert**: sie hat seit über einer Stunde nicht
  gemessen (siehe **Alter der Messung**), oder ihre Sensoren sind von einer Art,
  die die Integration auslässt (von **Boxen prüfen** aufgelistet).
- **„Die API von openSenseMap antwortet nicht“**: der Dienst ist ausgefallen
  oder von Gladys aus nicht erreichbar; die Messungen laufen von selbst wieder
  an.
- **Ein Funktionsname ist in der falschen Sprache**: Namen werden beim
  Hinzufügen des Geräts festgelegt. Ändere die **Sprache**, lösche das Gerät
  und füge es im Tab Entdecken erneut hinzu (sein Verlauf geht verloren).

## Grenzen

- Bürgersensoren, keine Referenzstationen: günstige Feinstaubsensoren messen
  bei feuchter Luft zu hoch, ein Sensor in der Sonne zu warm. Die Werte sind
  Richtwerte.
- Ausgelassen: UV in µW/cm² (keine Gladys-Einheit, keine zuverlässige
  Umrechnung), PM4, VOC in kOhm, Windrichtung und Regenmengen. **Boxen prüfen**
  listet sie für jede Box auf. Die Suche um ein Haus lässt mobile Boxen
  (Fahrräder) aus.
- Eine Funktion wird nie entfernt: ein von einer Box abgebauter Sensor behält
  seine Funktion, ohne neue Werte.
- Höchstens 20 Boxen, jede höchstens alle 5 Minuten gelesen.
