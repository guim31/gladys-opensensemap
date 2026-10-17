// -----------------------------------------------------------------------------
// Client of the public openSenseMap API (no account, no key).
//
//   GET https://api.opensensemap.org/boxes/<box id>?format=json
//       one box: name, exposure, location, and each sensor with its title,
//       unit and last measurement { value, createdAt }
//   GET https://api.opensensemap.org/boxes?near=<lon>,<lat>&maxDistance=<m>&date=<from>,<to>&format=json
//       the boxes around a point that measured in the time window (the
//       nearby search), with the same sensor details
//
// Terms (docs.opensensemap.org): free and open (data under PDDL), run by the
// non-profit openSenseLab, rate-limited per address. The integration reads a
// box at most every 5 minutes, one box after the other, and names itself in
// the User-Agent.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { classify, toValue } from './phenomena.js';

export const API_BASE_URL = 'https://api.opensensemap.org';
const TIMEOUT_MS = 20_000;

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Identifies the integration to the operators. */
export const USER_AGENT = `gladys-opensensemap/${version} (+https://github.com/guim31/gladys-opensensemap)`;

/** An error of the API (status kept for the messages: 404 = unknown box). */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * GET a JSON document from the API.
 * @param {string} path e.g. "/boxes/5cd81adfff898b001ae7c4c6?format=json"
 * @param {{ fetch?: typeof fetch }} [deps]
 */
async function getJson(path, { fetch = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? err.message);
    throw new ApiError(`openSenseMap API unreachable (${reason})`, 0);
  }
  if (response.status === 404) {
    throw new ApiError('box not found on openSenseMap', 404);
  }
  if (!response.ok) {
    throw new ApiError(`openSenseMap API answered HTTP ${response.status}`, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError('openSenseMap API answered something that is not JSON', response.status);
  }
}

/** An ISO time of the API, as epoch milliseconds (null when absent or invalid). */
export function parseTime(text) {
  const time = typeof text === 'string' ? Date.parse(text) : NaN;
  return Number.isFinite(time) ? time : null;
}

/**
 * A box of the API, reduced to what the integration uses. Sensors of an
 * unknown measure are kept aside (`unknown`), for the check action.
 * @param {any} body
 */
export function parseBox(body) {
  if (!body || typeof body !== 'object' || typeof body._id !== 'string') {
    throw new ApiError('openSenseMap API answered an unexpected document', 200);
  }
  const [longitude, latitude] = Array.isArray(body.currentLocation?.coordinates)
    ? body.currentLocation.coordinates
    : [];
  const sensors = [];
  const unknown = [];
  for (const sensor of Array.isArray(body.sensors) ? body.sensors : []) {
    if (!sensor || typeof sensor._id !== 'string') {
      continue;
    }
    const title = String(sensor.title ?? '').trim();
    const known = classify(sensor);
    if (!known) {
      unknown.push(`${title || '?'} (${sensor.unit ?? ''})`);
      continue;
    }
    // In a box list, lastMeasurement may be a bare id (no value): no measurement then.
    const last =
      sensor.lastMeasurement && typeof sensor.lastMeasurement === 'object'
        ? sensor.lastMeasurement
        : null;
    sensors.push({
      key: sensor._id.toLowerCase(),
      measure: known.measure,
      title: title.slice(0, 40),
      sensorType:
        String(sensor.sensorType ?? '')
          .trim()
          .slice(0, 30) || null,
      value: last ? toValue(known.measure, known.convert, last.value) : null,
      measuredAt: last ? parseTime(last.createdAt) : null,
    });
  }
  return {
    id: body._id.toLowerCase(),
    name: String(body.name ?? '').trim(),
    model: typeof body.model === 'string' ? body.model : null,
    exposure: typeof body.exposure === 'string' ? body.exposure : null,
    location:
      Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null,
    lastMeasurementAt: parseTime(body.lastMeasurementAt),
    sensors,
    unknown,
  };
}

/**
 * One box. Throws ApiError 404 for an id openSenseMap does not know.
 * @param {string} boxId
 * @param {{ fetch?: typeof fetch }} [deps]
 */
export async function fetchBox(boxId, deps) {
  return parseBox(await getJson(`/boxes/${encodeURIComponent(boxId)}?format=json`, deps));
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance, in kilometres.
 * @param {{ latitude: number, longitude: number }} a
 * @param {{ latitude: number, longitude: number }} b
 */
export function distanceKm(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearby search only lists the boxes that measured in this window. */
export const NEARBY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The boxes that measured in the last 24 hours within `radiusKm` of a point,
 * nearest first. Mobile boxes (bikes) are left out: their place changes.
 * @param {{ latitude: number, longitude: number }} center
 * @param {number} radiusKm
 * @param {{ fetch?: typeof fetch, now?: () => number }} [deps]
 */
export async function fetchNearby(center, radiusKm, deps = {}) {
  const now = deps.now?.() ?? Date.now();
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const query = new URLSearchParams({
    near: `${center.longitude},${center.latitude}`,
    maxDistance: String(Math.round(radiusKm * 1000)),
    date: `${iso(now - NEARBY_WINDOW_MS)},${iso(now)}`,
    format: 'json',
  });
  const body = await getJson(`/boxes?${query}`, deps);
  if (!Array.isArray(body)) {
    throw new ApiError('openSenseMap API answered an unexpected document', 200);
  }
  const found = [];
  for (const raw of body) {
    let box;
    try {
      box = parseBox(raw);
    } catch {
      continue; // one malformed box never hides the others
    }
    if (!box.location || box.exposure === 'mobile') {
      continue;
    }
    const distance = distanceKm(center, box.location);
    if (distance <= radiusKm) {
      found.push({ ...box, distanceKm: distance });
    }
  }
  return found.sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
}
