// -----------------------------------------------------------------------------
// A simulated network: the public openSenseMap API, answering with the real
// answers recorded in test/fixtures/api. Tests never touch the real network.
//
// The fixtures carry the times of the day they were taken: `fresh()` moves
// them to "now", so the same answer reads as a recent measurement.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');

/** API fixture by name (test/fixtures/api/<name>.json). */
export const apiFixture = (name) => JSON.parse(read(`api/${name}.json`));

/** The box id of a fixture. */
export const boxIdOf = (name) => apiFixture(name)._id;

const shift = (iso, delta) => (iso ? new Date(Date.parse(iso) + delta).toISOString() : iso);

/** The newest time of a box answer, in ms. */
function newestOf(box) {
  const times = [
    Date.parse(box.lastMeasurementAt ?? '') || 0,
    ...(box.sensors ?? []).map((s) => Date.parse(s.lastMeasurement?.createdAt ?? '') || 0),
  ];
  return Math.max(...times);
}

/**
 * A box answer whose newest measurement is `ageMs` before `now`, the other
 * times shifted alike.
 */
export function fresh(box, now, ageMs = 60_000) {
  const delta = now - ageMs - newestOf(box);
  return {
    ...box,
    lastMeasurementAt: shift(box.lastMeasurementAt, delta),
    sensors: box.sensors.map((sensor) =>
      sensor.lastMeasurement && typeof sensor.lastMeasurement === 'object'
        ? {
            ...sensor,
            lastMeasurement: {
              ...sensor.lastMeasurement,
              createdAt: shift(sensor.lastMeasurement.createdAt, delta),
            },
          }
        : sensor,
    ),
  };
}

/**
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.boxes] box id → answer, or a
 *   function (now) => answer, or an Error to throw, or { status } for an HTTP error
 * @param {unknown} [options.near] the answer of the nearby search
 * @param {() => number} [options.now] the clock passed to the functions
 */
export function createNetwork({ boxes = {}, near = [], now = () => Date.now() } = {}) {
  const calls = [];

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  async function answer(route) {
    const value = typeof route === 'function' ? route(now()) : route;
    if (value instanceof Error) {
      throw value;
    }
    if (value && typeof value === 'object' && value.status && !value._id) {
      return json({ code: 'Error', message: 'nope' }, value.status);
    }
    return json(value);
  }

  async function fetch(url, options = {}) {
    const href = String(url);
    calls.push({ url: href, headers: options.headers ?? {} });
    const box = /^https:\/\/api\.opensensemap\.org\/boxes\/([^/?]+)\?format=json$/.exec(href);
    if (box) {
      return answer(boxes[box[1]] ?? { status: 404 });
    }
    if (href.startsWith('https://api.opensensemap.org/boxes?')) {
      return answer(near);
    }
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  }

  return {
    fetch,
    calls,
    boxes,
    /** Calls to the API for one box. */
    boxCalls: (id) => calls.filter((call) => call.url.includes(`/boxes/${id}?`)).length,
  };
}
