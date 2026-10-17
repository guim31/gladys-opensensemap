// -----------------------------------------------------------------------------
// The nearby search, on a real answer of the API around Toulouse.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';
import { apiFixture } from './helpers/network.js';

const HOUSE = { selector: 'home', name: 'Maison', latitude: 43.604, longitude: 1.444 };

test('the boxes that measured around the house, nearest first, with their measures', async () => {
  const world = await createWorld({
    houses: [HOUSE],
    network: { near: apiFixture('near-toulouse') },
  });
  const ack = await world.gladys.fake.action('find_nearby', { radius_km: '20' });
  assert.equal(ack.success, true, JSON.stringify(ack));
  const lines = ack.data.message.fr.split('\n');
  assert.equal(
    lines[0],
    '3 boîte(s) à moins de 20 km de « Maison », de la plus proche à la plus loin :',
  );
  // The owner placed "Arcachon" in Toulouse: the map shows what the owners set.
  assert.equal(
    lines[2],
    '6a8e86b0852a4900073a16b2 · CPIE5098427 · 2,2 km · intérieur · Température, Humidité, Pression, PM2.5, PM10',
  );
  assert.equal(
    lines[3],
    '5cd81adfff898b001ae7c4c6 · Saint-Simon Station · 7,2 km · Température, Humidité, PM2.5, PM10',
  );
  assert.match(lines.at(-1), /^Copiez les identifiants voulus/);

  const url = new URL(world.network.calls.at(-1).url);
  assert.equal(url.searchParams.get('near'), '1.444,43.604');
  assert.equal(url.searchParams.get('maxDistance'), '20000');
  assert.match(url.searchParams.get('date'), /^2026-10-16T15:00:00Z,2026-10-17T15:00:00Z$/);
});

test('no located house: the action says where to set it', async () => {
  const world = await createWorld({ houses: [{ selector: 'h', name: 'H' }] });
  const ack = await world.gladys.fake.action('find_nearby', {});
  assert.equal(ack.success, false);
  assert.match(ack.error, /Paramètres → Maisons/);
});

test('an empty area: try a wider radius', async () => {
  const world = await createWorld({ houses: [HOUSE], network: { near: [] } });
  const ack = await world.gladys.fake.action('find_nearby', { house: 'home', radius_km: '1' });
  assert.match(ack.data.message.en, /No box measured within 1 km of "Maison"/);
});
