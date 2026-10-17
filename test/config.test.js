import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, MAX_BOXES, normalizeConfig, parseBoxIds } from '../src/config.js';

const ID = '5cd81adfff898b001ae7c4c6';

test('the defaults: no box, every 5 minutes, French names', () => {
  assert.deepEqual(normalizeConfig(), {
    boxIds: [],
    invalidBoxIds: [],
    droppedBoxIds: [],
    refreshMinutes: 5,
    language: 'fr',
  });
  assert.equal(DEFAULT_CONFIG.language, 'fr');
});

test('box ids: separators, links from the map, case, duplicates and junk', () => {
  const other = '6107DF25C4AAB8001B94E043';
  assert.deepEqual(
    parseBoxIds(` ${ID}; https://opensensemap.org/explore/${other} ,${ID}\n12345 abc`),
    { valid: [ID, other.toLowerCase()], invalid: ['12345', 'abc'] },
  );
  assert.deepEqual(parseBoxIds(`https://opensensemap.org/explore/${ID}/`).valid, [ID]);
  assert.deepEqual(parseBoxIds(`https://api.opensensemap.org/boxes/${ID}?format=json`).valid, [ID]);
});

test('at most 20 boxes are read; unknown options fall back to the defaults', () => {
  const ids = Array.from({ length: 22 }, (_, i) => i.toString(16).padStart(24, 'a'));
  const config = normalizeConfig({ box_ids: ids.join(','), refresh_minutes: '1', language: 'it' });
  assert.equal(config.boxIds.length, MAX_BOXES);
  assert.deepEqual(config.droppedBoxIds, ids.slice(20));
  assert.equal(config.refreshMinutes, 5);
  assert.equal(config.language, 'fr');
  assert.equal(normalizeConfig({ refresh_minutes: '30' }).refreshMinutes, 30);
});
