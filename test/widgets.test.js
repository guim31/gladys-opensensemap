// -----------------------------------------------------------------------------
// The "Box measurements" widget: valid for the core (validateWidgetContent),
// within its budget, bound to features that exist.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createAll, createWorld, discovered } from './helpers/world.js';
import { apiFixture, boxIdOf, fresh } from './helpers/network.js';

const SIMON = boxIdOf('box-toulouse-saint-simon');
const FULL = boxIdOf('box-muenster-full');

async function content(world, settings, language = 'fr') {
  const ack = await world.gladys.fake.widgetGet('box_measurements', { settings, language });
  assert.equal(ack.success, true, JSON.stringify(ack));
  const { content } = ack.data;
  validateWidgetContent(content);
  assert.ok(content.components.length <= 8, 'budget of the core: 8 components');
  assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
  return content;
}

test('no box added yet: a sentence says where to add one', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  const data = await content(world, {});
  assert.equal(data.components[0].type, 'text');
  assert.match(data.components[0].text, /Découverte/);
});

test('one box: live tiles bound to its features, and its last measurement', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon', 'box-muenster-full'] });
  await createAll(world);
  const device = discovered(world, SIMON);
  const data = await content(world, { box: device.external_id });
  const tiles = data.components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => tile.label),
    ['Température', 'Humidité', 'PM2.5', 'PM10'],
  );
  const features = new Set(device.features.map((f) => f.external_id));
  for (const tile of tiles) {
    assert.ok(features.has(tile.device_feature), tile.device_feature);
  }
  const status = data.components.at(-1);
  assert.equal(status.items[0].value, 'il y a 1 min');
  assert.equal(status.items[0].color, 'success');

  // A big box: six tiles at most, one per measure.
  const big = await content(world, { box: discovered(world, FULL).external_id }, 'de');
  assert.equal(big.components.filter((c) => c.type === 'value').length, 6);
});

test('every box: one row each, red when offline', async () => {
  const world = await createWorld({
    fixtures: ['box-toulouse-saint-simon', 'box-muenster-library'],
  });
  await createAll(world);
  world.network.boxes[SIMON] = fresh(apiFixture('box-toulouse-saint-simon'), world.clock.now);
  for (let i = 0; i < 14; i += 1) {
    world.advance(5 * 60_000);
    await world.app.poller.cycle();
  }
  const data = await content(world, {}, 'en');
  const [simon, library] = data.components[0].items;
  assert.equal(simon.label, 'Saint-Simon Station (openSenseMap)');
  assert.equal(simon.value, 'Offline for 71 min');
  assert.equal(simon.color, 'danger');
  assert.equal(library.color, 'success');
  assert.ok(world.gladys.fake.widgetRefreshes.length > 1, 'refreshed when the box went offline');
});

test('a box no longer configured: the widget says so', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await createAll(world);
  const device = discovered(world, SIMON);
  await world.gladys.fake.configUpdated({ box_ids: '' });
  const data = await content(world, { box: device.external_id }, 'es');
  assert.match(data.components[0].text, /ya no se lee/);
});
