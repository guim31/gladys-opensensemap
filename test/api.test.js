// -----------------------------------------------------------------------------
// The openSenseMap client: parsing of real answers, and its errors.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, fetchBox, parseBox } from '../src/api.js';
import { apiFixture } from './helpers/network.js';

const respond =
  (body, status = 200) =>
  async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

test('a box: identity, location, known sensors with their values, the rest aside', () => {
  const box = parseBox(apiFixture('box-weather-station'));
  assert.equal(box.id, '591f578c51d34600116a8ea5');
  assert.equal(box.exposure, 'outdoor');
  assert.equal(typeof box.location.latitude, 'number');
  assert.equal(box.sensors.length, 9);
  const gusts = box.sensors.find((sensor) => sensor.title === 'Windböen');
  assert.equal(gusts.measure, 'wind_speed');
  assert.equal(typeof gusts.measuredAt, 'number');
  assert.deepEqual(box.unknown, [
    'UV-Intensität (μW/cm²)',
    'Windrichtung (°)',
    'Niederschlag (mm/m²)',
  ]);
});

test('a box never measured: its sensors, without values', () => {
  const box = parseBox(apiFixture('box-muenster-full'));
  assert.equal(box.lastMeasurementAt, null);
  assert.ok(box.sensors.every((sensor) => sensor.value === null && sensor.measuredAt === null));
});

test('errors: unknown box, HTTP error, not JSON, unreachable, unexpected document', async () => {
  const id = '5cd81adfff898b001ae7c4c6';
  await assert.rejects(fetchBox(id, { fetch: respond({ code: 'NotFound' }, 404) }), {
    name: 'ApiError',
    status: 404,
  });
  await assert.rejects(fetchBox(id, { fetch: respond({}, 503) }), /HTTP 503/);
  await assert.rejects(fetchBox(id, { fetch: respond('<html>') }), /not JSON/);
  await assert.rejects(fetchBox(id, { fetch: respond([]) }), /unexpected document/);
  const down = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  };
  await assert.rejects(fetchBox(id, { fetch: down }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.message, 'openSenseMap API unreachable (ECONNREFUSED)');
    return true;
  });
});
