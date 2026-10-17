// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a simulated network, a store
// in memory, a clock, and the integration wired on top (registerHandlers).
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { apiFixture, boxIdOf, createNetwork, fresh } from './network.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

/** The test clock starts here (the day the fixtures were taken). */
export const START = Date.parse('2026-10-17T15:00:00Z');

/** Boxes answering fresh fixtures, by box id. */
export function freshBoxes(names) {
  return Object.fromEntries(
    names.map((name) => [boxIdOf(name), (now) => fresh(apiFixture(name), now)]),
  );
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {string[]} [options.fixtures] box fixtures served fresh, and configured
 * @param {object} [options.network] createNetwork options, merged over the fixtures
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.store] persistence (MemoryStore by default)
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] run the polling timer, on Date.now
 */
export async function createWorld({
  config = {},
  fixtures = [],
  network: networkOptions = {},
  devices = [],
  houses = [],
  store = new MemoryStore(),
  connect = true,
  timers = false,
} = {}) {
  // With the timers on, the clock is Date.now (to be mocked by the test).
  const clock = { now: START };
  const now = timers ? () => Date.now() : () => clock.now;
  const network = createNetwork({
    ...networkOptions,
    boxes: { ...freshBoxes(fixtures), ...networkOptions.boxes },
    now,
  });
  const fullConfig = { box_ids: fixtures.map(boxIdOf).join(','), ...config };
  const gladys = createFakeGladys({ config: fullConfig, devices, houses });
  const app = registerHandlers(gladys, { store, fetch: network.fetch, timers, now });
  if (connect) {
    await gladys.connect();
  }
  return {
    gladys,
    app,
    network,
    store,
    clock,
    hub: app.hub,
    /** Move the clock forward. */
    advance(ms) {
      clock.now += ms;
    },
  };
}

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.gladys.fake.discoveredDevices) {
    await world.gladys.fake.deviceCreated(device);
  }
}

/** The discovered device of a box. */
export function discovered(world, boxId) {
  const id = world.gladys.externalIds('box', boxId).device;
  return world.gladys.fake.discoveredDevices.find((device) => device.external_id === id);
}

/** The external id of a feature of a box. */
export const featureId = (gladys, boxId, key) => gladys.externalIds('box', boxId).feature(key);
