// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld } from './helpers/world.js';
import { apiFixture, boxIdOf, fresh } from './helpers/network.js';

const SIMON = boxIdOf('box-toulouse-saint-simon');

/** Capture the log lines (the SDK logger writes through console) at a level. */
function capture(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await createAll(w);
  // Start-up says what it reads and what it found: lifecycle.
  assert.ok(lines.some((line) => line.includes('[INFO]') && line.includes(`Box ${SIMON} found`)));
  const before = lines.length;
  for (let i = 0; i < 12; i += 1) {
    w.advance(5 * 60_000);
    await w.app.poller.cycle();
    await w.gladys.fake.widgetGet('box_measurements', { language: 'fr' });
    await w.gladys.fake.poll(w.gladys.fake.discoveredDevices[0]);
  }
  assert.deepEqual(lines.slice(before), []);
});

test('a lasting API failure: one line when it starts, one when it ends', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await createAll(w);
  const before = lines.length;
  w.network.boxes[SIMON] = { status: 503 };
  for (let i = 0; i < 6; i += 1) {
    w.advance(5 * 60_000);
    await w.app.poller.cycle();
  }
  w.network.boxes[SIMON] = (now) => fresh(apiFixture('box-toulouse-saint-simon'), now);
  w.advance(5 * 60_000);
  await w.app.poller.cycle();
  const logged = lines.slice(before);
  assert.equal(logged.filter((line) => line.includes('HTTP 503')).length, 1, logged.join('\n'));
  assert.equal(logged.filter((line) => line.includes('API answers again')).length, 1);
});

test('a box gone silent: said once when it goes offline, once when it is back', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await createAll(w);
  const before = lines.length;
  w.network.boxes[SIMON] = fresh(apiFixture('box-toulouse-saint-simon'), w.clock.now);
  for (let i = 0; i < 24; i += 1) {
    w.advance(5 * 60_000);
    await w.app.poller.cycle();
  }
  w.network.boxes[SIMON] = (now) => fresh(apiFixture('box-toulouse-saint-simon'), now);
  w.advance(5 * 60_000);
  await w.app.poller.cycle();
  const logged = lines.slice(before);
  assert.deepEqual(
    logged.map((line) => line.replace(/^\[[^\]]+\] \[(\w+)\] \[\w+\] /, '$1 ')),
    [
      'WARN Saint-Simon Station (openSenseMap): no measurement for 61 min',
      'INFO Saint-Simon Station (openSenseMap): offline for 1 h',
      'INFO Saint-Simon Station (openSenseMap): measurements again',
      'INFO Saint-Simon Station (openSenseMap): back online',
    ],
    logged.join('\n'),
  );
});
