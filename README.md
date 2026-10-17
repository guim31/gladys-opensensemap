# openSenseMap for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings the measurements of the citizen sensor boxes of
[openSenseMap](https://opensensemap.org) (senseBox, airRohr and custom boxes)
into Gladys: your own box, or the public boxes around your home.

This integration is **not affiliated with openSenseMap, openSenseLab or
senseBox**.

## What it does

- **One device per box**, read through the public openSenseMap API: no
  account, no key. A **Find boxes near a house** button lists the boxes that
  measured in the last 24 hours around the location of a Gladys house.
- **One feature per known sensor**: temperature, humidity, pressure, PM2.5,
  PM10, PM1, CO2, VOC, noise, illuminance, UV index, wind speed, rain rate,
  soil moisture and soil temperature, recognized by their unit and title (the
  owners name them freely), converted to the Gladys unit (Pa → hPa, m/s →
  km/h). The others are left out and listed by **Check the boxes**.
- The **age of the last measurement**: a value older than an hour is not sent
  again, and the box is shown offline.
- A **Box measurements** dashboard widget, scene triggers **Box offline**
  (after 1, 3, 6, 12, 24 or 48 hours) and **Box back online**, and a scene
  action **Get the measurements of a box** (a sentence ready for a
  notification).

Read only: nothing is ever written to a box.

The user documentation, in [English](docs/en.md), [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md), is re-hosted by Gladys behind
the **Documentation** link of the Configuration screen.

## Requirements

- Gladys Assistant **5.2.0** or later (the nearby search uses the house picker
  of 5.2.0; the widget and the scene cards need 5.1).
- Internet access.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-opensensemap`. Then fill the Configuration
tab: see [the documentation](docs/en.md#configuration).

## Respect of the API

openSenseMap is a free service run by the non-profit openSenseLab, with data
under the PDDL. The integration:

- reads a box **every 5 minutes at most** (10, 15 or 30 minutes on request),
  20 boxes at most, one request after the other;
- reads only the boxes whose device was added to Gladys (and, once, the ones
  it does not know yet, to list them in the Discovery tab);
- sends a `User-Agent` naming the integration and this repository;
- limits the nearby search to the boxes that measured in the last 24 hours
  (`date` filter), which keeps the answers small.

## Limits

- Citizen sensors, not reference stations: the values are indications.
- UV in µW/cm² (senseBox VEML6070) has no Gladys unit nor reliable conversion
  to a UV index: left out, like PM4, VOC in kOhm, wind direction and rain
  amounts.
- Tested against real answers of the openSenseMap API, recorded around
  Toulouse and Münster, and against the SDK's fake Gladys: not yet on a live
  Gladys. Feedback welcome on the Gladys forum.

## Development

```bash
npm install
npm test                 # node --test, never touches the network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the pitfalls of the Gladys
core. Versions and releases are made by the Release workflow.

## Credits

- [openSenseMap](https://opensensemap.org) and
  [openSenseLab](https://www.opensenselab.org), for the open platform and its
  API ([docs](https://docs.opensensemap.org)). The test fixtures are real
  answers of the API (public data, PDDL).
- The Home Assistant `opensensemap` integration (Apache 2.0) and its
  `opensensemap-api` library showed the use of the box endpoint; no code was
  copied.
- The architecture follows
  [gladys-sensor-community](https://github.com/guim31/gladys-sensor-community).

## License

[Apache-2.0](LICENSE)
