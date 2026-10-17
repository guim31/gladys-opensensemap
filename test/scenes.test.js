// -----------------------------------------------------------------------------
// Scene action "Get the measurements of a box".
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered } from './helpers/world.js';
import { apiFixture, boxIdOf, fresh } from './helpers/network.js';

const SIMON = boxIdOf('box-toulouse-saint-simon');

test('the last values of a box, and a sentence for a notification', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await createAll(world);
  const box = discovered(world, SIMON).external_id;
  const ack = await world.gladys.fake.sceneAction('get_measurements', { box });
  assert.equal(ack.success, true, JSON.stringify(ack));
  assert.deepEqual(ack.data.outputs, {
    summary:
      'Saint-Simon Station (openSenseMap): Température 17,8 °C · Humidité 99,9 % · PM2.5 2 µg/m³ · PM10 3,3 µg/m³ · il y a 1 min',
    age_minutes: 1,
    temperature: 17.8,
    humidity: 99.9,
    pm25: 2,
    pm10: 3.3,
  });
});

test('an offline box: no stale value, the summary says it', async () => {
  const world = await createWorld({
    fixtures: ['box-toulouse-saint-simon'],
    config: { language: 'en' },
  });
  await createAll(world);
  world.network.boxes[SIMON] = fresh(apiFixture('box-toulouse-saint-simon'), world.clock.now);
  world.advance(3 * 60 * 60_000);
  await world.app.poller.cycle();
  const box = discovered(world, SIMON).external_id;
  const ack = await world.gladys.fake.sceneAction('get_measurements', { box });
  assert.deepEqual(ack.data.outputs, {
    summary: 'Saint-Simon Station (openSenseMap): Offline for 3 h',
    age_minutes: 181,
  });
});

test('an unknown box fails the action, in every language', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  const ack = await world.gladys.fake.sceneAction('get_measurements', { box: 'nope' });
  assert.equal(ack.success, false);
  assert.equal(ack.error.split(' / ').length, 4);
});
