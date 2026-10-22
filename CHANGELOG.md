# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-17

### Added

- openSenseMap boxes in Gladys, read from the public API (no account): one
  device per box, with a feature per sensor the integration knows
  (temperature, humidity, pressure, PM2.5, PM10, PM1, CO2, VOC, noise,
  illuminance, UV index, wind speed, rain rate, soil moisture and soil
  temperature) and the age of the last measurement.
- A "Find boxes near a house" button listing the boxes that measured in the
  last 24 hours around a Gladys house, and a "Check the boxes" button.
- Scene triggers "Box offline" (after 1, 3, 6, 12, 24 or 48 hours without
  measurement) and "Box back online".
- Scene action "Get the measurements of a box", with a sentence ready for a
  notification.
- Dashboard widget "Box measurements".
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-opensensemap/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-opensensemap/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-opensensemap/releases/tag/v1.0.0
