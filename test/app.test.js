// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and a simulated
// openSenseMap API answering recorded boxes: discovery, states, freshness,
// offline triggers, persistence and the status of the Configuration screen.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered, featureId } from './helpers/world.js';
import { apiFixture, boxIdOf, fresh } from './helpers/network.js';
import { MemoryStore } from '../src/store.js';
import { TEXT } from '../src/i18n.js';

const SIMON = boxIdOf('box-toulouse-saint-simon');
const OFFLINE = boxIdOf('box-toulouse-offline');
const HOUR = 60 * 60_000;
const featureKeys = (device) => device.features.map((f) => f.external_id.split(':').pop());
const sensorId = (name, title) =>
  apiFixture(name).sensors.find((sensor) => sensor.title === title)._id;

/** Serve a box whose last measurement is `ageMs` old, whatever the clock. */
const agedBy = (name, ageMs) => (now) => fresh(apiFixture(name), now, ageMs);

test('without configuration: nothing is read, the status says what to enter', async () => {
  const { gladys, network } = await createWorld();
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  assert.equal(network.calls.length, 0);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: false, message: TEXT.notConfigured });
});

test('discovery: one device per box, one feature per known sensor, and the age', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon', 'box-muenster-full'] });
  const simon = discovered(world, SIMON);
  assert.equal(simon.name, 'Saint-Simon Station (openSenseMap)');
  assert.equal(simon.model, 'luftdaten_sds011_dht22');
  assert.deepEqual(simon.params, [{ name: 'box_id', value: SIMON }]);
  const names = simon.features.map((f) => f.name);
  assert.deepEqual(names, ['Température', 'Humidité', 'PM2.5', 'PM10', 'Âge de la mesure']);
  assert.equal(featureKeys(simon)[0], sensorId('box-toulouse-saint-simon', 'Temperatur'));
  assert.equal(featureKeys(simon).at(-1), 'age');

  // Twice the same measure: the second carries the owner's title.
  const full = discovered(world, boxIdOf('box-muenster-full'));
  const fullNames = full.features.map((f) => f.name);
  assert.ok(fullNames.includes('Température (Lufttemperatur)'), fullNames.join(' | '));
  assert.ok(fullNames.includes('Température du sol'));
  assert.equal(fullNames.length, 15, '14 known sensors and the age');
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  // Gladys drops the states of a device it does not know: none is sent.
  assert.equal(world.gladys.fake.states.length, 0);
});

test('adding a device sends its states at once, and nudges the widget', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  const { gladys } = world;
  await createAll(world);
  const state = (title) =>
    gladys.fake.lastState(featureId(gladys, SIMON, sensorId('box-toulouse-saint-simon', title)));
  assert.equal(state('Temperatur'), 17.8);
  assert.equal(state('rel. Luftfeuchte'), 99.9);
  assert.equal(state('PM2.5'), 2);
  assert.equal(state('PM10'), 3.3);
  assert.equal(gladys.fake.lastState(featureId(gladys, SIMON, 'age')), 1);
  assert.ok(gladys.fake.widgetRefreshes.includes('box_measurements'));
});

test('adding a device after a restart reads it once and sends each state once', async () => {
  const store = new MemoryStore();
  const first = await createWorld({ fixtures: ['box-toulouse-saint-simon'], store });
  await first.app.stop();
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'], store });
  world.advance(10 * 60_000);
  await createAll(world);
  const sent = world.gladys.fake.states.map((s) => s.device_feature_external_id);
  assert.equal(sent.length, 5);
  assert.equal(new Set(sent).size, 5);
});

test('pressure in Pa is published in hPa', async () => {
  const world = await createWorld({
    config: { box_ids: OFFLINE },
    network: { boxes: { [OFFLINE]: agedBy('box-toulouse-offline', 0) } },
  });
  // This recorded box has no value left, only its last time: no value, no state.
  await createAll(world);
  const pressure = discovered(world, OFFLINE).features.find((f) => f.name === 'Pression');
  assert.equal(pressure.unit, 'hPa');
  assert.equal(world.gladys.fake.lastState(pressure.external_id), undefined);
});

test('only the boxes added to Gladys are read on the timer, one request per period', async () => {
  const world = await createWorld({
    fixtures: ['box-toulouse-saint-simon', 'box-muenster-library'],
  });
  const library = boxIdOf('box-muenster-library');
  await world.gladys.fake.deviceCreated(discovered(world, SIMON));
  const before = { simon: world.network.boxCalls(SIMON), library: world.network.boxCalls(library) };
  for (let minute = 1; minute <= 10; minute += 1) {
    world.advance(60_000);
    await world.app.poller.cycle();
    await world.gladys.fake.poll(discovered(world, SIMON)); // the core's fallback, every minute
  }
  assert.equal(world.network.boxCalls(SIMON) - before.simon, 2, 'every 5 minutes');
  assert.equal(world.network.boxCalls(library) - before.library, 0, 'not added: not read');
});

test('a stale value is not published again; the age keeps counting', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  const { gladys } = world;
  await createAll(world);
  const temperature = featureId(gladys, SIMON, sensorId('box-toulouse-saint-simon', 'Temperatur'));
  // The box goes silent: the API keeps answering its last measurement.
  const frozen = fresh(apiFixture('box-toulouse-saint-simon'), world.clock.now);
  world.network.boxes[SIMON] = frozen;
  const count = () =>
    gladys.fake.states.filter((s) => s.device_feature_external_id === temperature).length;
  const sent = count();
  for (let i = 0; i < 24; i += 1) {
    world.advance(5 * 60_000);
    await world.app.poller.cycle();
  }
  assert.equal(count(), sent, 'no new temperature state while it does not change');
  assert.equal(gladys.fake.lastState(featureId(gladys, SIMON, 'age')), 121);
});

test('box offline: one event per step crossed, then back online', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  const { gladys } = world;
  await createAll(world);
  const frozen = fresh(apiFixture('box-toulouse-saint-simon'), world.clock.now);
  world.network.boxes[SIMON] = frozen;
  for (let i = 0; i < 12 * 7; i += 1) {
    world.advance(5 * 60_000);
    await world.app.poller.cycle();
  }
  const offline = gladys.fake.sceneEvents.filter((e) => e.key === 'box_offline');
  assert.deepEqual(
    offline.map((e) => e.data.hours),
    ['1', '3', '6'],
  );
  assert.equal(offline[0].data.device, gladys.externalIds('box', SIMON).device);
  assert.equal(offline[0].data.box_name, 'Saint-Simon Station (openSenseMap)');
  assert.equal(offline[0].data.offline_minutes, 61);
  assert.match(offline[0].data.last_measurement, /^\d{4}-\d{2}-\d{2}T.*Z$/);

  // Back: one event, and every value is sent again (Gladys dates it now).
  world.network.boxes[SIMON] = agedBy('box-toulouse-saint-simon', 60_000);
  const temperature = featureId(gladys, SIMON, sensorId('box-toulouse-saint-simon', 'Temperatur'));
  const before = gladys.fake.states.filter(
    (s) => s.device_feature_external_id === temperature,
  ).length;
  world.advance(5 * 60_000);
  await world.app.poller.cycle();
  const back = gladys.fake.sceneEvents.filter((e) => e.key === 'box_back_online');
  assert.equal(back.length, 1);
  assert.equal(back[0].data.offline_minutes, 425);
  const after = gladys.fake.states.filter(
    (s) => s.device_feature_external_id === temperature,
  ).length;
  assert.equal(after, before + 1);
});

test('a box already silent at install fires nothing; an API outage is not a box offline', async () => {
  const world = await createWorld({
    config: { box_ids: SIMON },
    network: { boxes: { [SIMON]: agedBy('box-toulouse-saint-simon', 30 * HOUR) } },
  });
  await createAll(world);
  world.advance(5 * 60_000);
  await world.app.poller.cycle();
  assert.deepEqual(world.gladys.fake.sceneEvents, []);

  // A fresh box, then the API fails for 3 hours.
  world.network.boxes[SIMON] = agedBy('box-toulouse-saint-simon', 60_000);
  world.advance(5 * 60_000);
  await world.app.poller.cycle();
  world.network.boxes[SIMON] = { status: 503 };
  for (let i = 0; i < 36; i += 1) {
    world.advance(5 * 60_000);
    await world.app.poller.cycle();
  }
  assert.deepEqual(
    world.gladys.fake.sceneEvents.filter((e) => e.key === 'box_offline'),
    [],
  );
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.apiUnreachable,
  });
});

test('restart: the boxes come back from /data, even while the API is down', async () => {
  const store = new MemoryStore();
  const first = await createWorld({ fixtures: ['box-toulouse-saint-simon'], store });
  await createAll(first);
  await first.app.stop();
  const second = await createWorld({
    config: { box_ids: SIMON },
    store,
    network: { boxes: { [SIMON]: { status: 503 } } },
    devices: first.gladys.fake.devices,
  });
  assert.equal(discovered(second, SIMON).features.length, 5);
  assert.ok(second.hub.records.has(SIMON));
});

test('an unknown box id: no device, said by the check action', async () => {
  const unknown = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const world = await createWorld({ config: { box_ids: `${unknown}, nope` } });
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
  const ack = await world.gladys.fake.action('check_boxes', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /aaaaaaaaaaaaaaaaaaaaaaaa : boîte inconnue d'openSenseMap/);
  assert.match(ack.data.message.fr, /Ignoré, ce n'est pas un identifiant de boîte : nope/);
  // A wrong id is not an outage of the API.
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('a box removed from the configuration is forgotten', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await world.gladys.fake.configUpdated({ box_ids: '' });
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
  assert.equal(world.hub.records.size, 0);
});

test('the requests name the integration in their User-Agent', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  assert.match(world.network.calls[0].headers['User-Agent'], /^gladys-opensensemap\//);
});

test('one box the API fails to serve: no flapping, the status stays connected', async () => {
  const world = await createWorld({
    fixtures: ['box-toulouse-saint-simon', 'box-muenster-library'],
  });
  await createAll(world);
  const library = boxIdOf('box-muenster-library');
  world.network.boxes[library] = { status: 500 };
  for (let i = 0; i < 3; i += 1) {
    world.advance(5 * 60_000);
    await world.app.poller.cycle();
  }
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('a box added long after its first read starts from a first look: no burst', async () => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  // Read once, not added; days later the box is silent, then the user adds it.
  world.network.boxes[SIMON] = fresh(apiFixture('box-toulouse-saint-simon'), world.clock.now);
  world.advance(3 * 24 * HOUR);
  await createAll(world);
  world.advance(5 * 60_000);
  await world.app.poller.cycle();
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
});

test('a scene event Gladys refused is sent again on the next read', async (t) => {
  const world = await createWorld({ fixtures: ['box-toulouse-saint-simon'] });
  await createAll(world);
  world.network.boxes[SIMON] = fresh(apiFixture('box-toulouse-saint-simon'), world.clock.now);
  const real = world.gladys.publishSceneEvent.bind(world.gladys);
  let refuse = true;
  t.mock.method(world.gladys, 'publishSceneEvent', async (...args) => {
    if (refuse) {
      throw new Error('429');
    }
    return real(...args);
  });
  for (let i = 0; i < 13; i += 1) {
    world.advance(5 * 60_000);
    await world.app.poller.cycle();
  }
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
  refuse = false;
  world.advance(5 * 60_000);
  await world.app.poller.cycle();
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((e) => e.data.hours),
    ['1'],
  );
});
