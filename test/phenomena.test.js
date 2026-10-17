// -----------------------------------------------------------------------------
// The measure of each sensor of the recorded boxes: titles and units as the
// owners wrote them (German senseBox templates, airRohr imports, custom boxes).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, normalizeUnit, toValue } from '../src/phenomena.js';
import { apiFixture } from './helpers/network.js';

const measures = (name) =>
  apiFixture(name).sensors.map((sensor) => [sensor.title, classify(sensor)?.measure ?? null]);

test('a senseBox:home with every sensor family', () => {
  assert.deepEqual(measures('box-muenster-full'), [
    ['Temperatur', 'temperature'],
    ['rel. Luftfeuchte', 'humidity'],
    ['Luftdruck', 'pressure'],
    ['Beleuchtungsstärke', 'illuminance'],
    ['UV-Intensität', null], // µW/cm²: no Gladys unit
    ['PM10', 'pm10'],
    ['PM2.5', 'pm25'],
    ['Luftfeuchte', 'humidity'],
    ['Lufttemperatur', 'temperature'],
    ['atm. Luftdruck', 'pressure'],
    ['VOC', null], // kOhm: a raw gas resistance, not a concentration
    ['Bodenfeuchte', 'soil_moisture'],
    ['Bodentemperatur', 'soil_temperature'],
    ['Lautstärke', 'noise'],
    ['Windgeschwindigkeit', 'wind_speed'],
    ['CO₂', 'co2'],
  ]);
});

test('a weather station: UV index, wind and gusts, but no direction nor rain amount', () => {
  assert.deepEqual(measures('box-weather-station'), [
    ['Temperatur', 'temperature'],
    ['rel. Luftfeuchte', 'humidity'],
    ['Luftdruck', 'pressure'],
    ['Beleuchtungsstärke', 'illuminance'],
    ['UV-Intensität', null],
    ['UV-Index', 'uv_index'],
    ['PM10', 'pm10'],
    ['PM2.5', 'pm25'],
    ['Windgeschwindigkeit', 'wind_speed'],
    ['Windböen', 'wind_speed'],
    ['Windrichtung', null],
    ['Niederschlag', null],
  ]);
});

test('an airRohr import (pressure in Pa) and a box with PM1 and PM4', () => {
  assert.deepEqual(measures('box-toulouse-offline'), [
    ['PM10', 'pm10'],
    ['PM2.5', 'pm25'],
    ['Temperatur', 'temperature'],
    ['Luftdruck', 'pressure'],
  ]);
  assert.deepEqual(measures('box-muenster-noise'), [
    ['Temperatur', 'temperature'],
    ['rel. Luftfeuchte', 'humidity'],
    ['Lautstärke (LEQ 60s)', 'noise'],
    ['PM1', 'pm1'],
    ['PM2.5', 'pm25'],
    ['PM4', null],
    ['PM10', 'pm10'],
  ]);
});

test('the titles of other owners', () => {
  const of = (title, unit) => classify({ title, unit })?.measure ?? null;
  assert.equal(of('Finedust PM1', 'µg/m³'), 'pm1');
  assert.equal(of('Feinstaub PM1.0', 'µg/m³'), 'pm1');
  assert.equal(of('PM25', 'ug/m3'), 'pm25');
  assert.equal(of('Rel. Humidity', '%'), 'humidity');
  assert.equal(of('Surface Asphalt', '%'), null);
  assert.equal(of('Pressure', 'mBar'), 'pressure');
  assert.equal(of('Lichtintesität', 'Lux'), 'illuminance');
  assert.equal(of('Lautstärke', 'db'), 'noise');
  assert.equal(of('Speed', 'm/s'), null, 'a bike, not the wind');
  assert.equal(of('Temp ~ Battery', '°C'), 'temperature');
  assert.equal(of('Rain Sensor', 'D/W'), null);
  assert.equal(normalizeUnit('dB (A)'), 'db(a)');
  assert.equal(normalizeUnit('μg/m³'), 'µg/m³');
});

test('values: strings to numbers, Pa to hPa, m/s to km/h, rounded', () => {
  const value = (title, unit, raw) => {
    const known = classify({ title, unit });
    return toValue(known.measure, known.convert, raw);
  };
  assert.equal(value('Luftdruck', 'Pa', '101325.00'), 1013.3);
  assert.equal(value('Luftdruck', 'hPa', '1016.6'), 1016.6);
  assert.equal(value('Windgeschwindigkeit', 'm/s', '2.5'), 9);
  assert.equal(value('Temperatur', '°C', '17.80'), 17.8);
  assert.equal(value('Lautstärke', 'dB (A)', '45.23'), 45);
  assert.equal(value('Temperatur', '°C', ''), null);
  assert.equal(value('Temperatur', '°C', 'NaN'), null);
  assert.equal(value('Temperatur', '°C', null), null);
});
