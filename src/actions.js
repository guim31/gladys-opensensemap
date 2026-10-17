// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   find_nearby : the boxes that measured in the last 24 hours around a house
//                 of Gladys (its location, `location: true` in the manifest),
//                 with their distance and measures — to pick the ids to read.
//   check_boxes : what each configured box answers right now, including the
//                 sensors the integration leaves out.
// -----------------------------------------------------------------------------

import { fetchNearby } from './api.js';
import { MESSAGES, TEXT } from './i18n.js';
import { MEASURE_ORDER } from './phenomena.js';

export const ACTION = {
  FIND_NEARBY: 'find_nearby',
  CHECK_BOXES: 'check_boxes',
};

/** Radii offered by the search (km), and the one used when none is picked. */
export const RADII_KM = ['1', '2', '5', '10', '20'];
const DEFAULT_RADIUS_KM = 5;

/** The search lists this many boxes at most (the message stays readable). */
const MAX_LISTED = 10;

/** The measures of a box, in display order, each once. */
const measuresOf = (sensors) =>
  MEASURE_ORDER.filter((measure) => sensors.some((sensor) => sensor.measure === measure));

/**
 * @param {object} gladys
 * @param {{ house?: string, radius_km?: string }} fields
 * @param {{ fetch?: typeof fetch, now?: () => number }} [deps]
 */
export async function findNearby(gladys, fields, deps) {
  const houses = (await gladys.getHouses()).filter(
    (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
  );
  const house = fields.house
    ? houses.find((candidate) => candidate.selector === fields.house)
    : houses[0];
  if (!house) {
    throw new Error(MESSAGES.thrown(TEXT.noHouse));
  }
  const radiusKm = RADII_KM.includes(String(fields.radius_km))
    ? Number(fields.radius_km)
    : DEFAULT_RADIUS_KM;
  const found = await fetchNearby(house, radiusKm, deps);
  const boxes = found
    .filter((box) => box.sensors.length > 0)
    .slice(0, MAX_LISTED)
    .map((box) => ({
      id: box.id,
      name: box.name.slice(0, 40) || '?',
      distanceKm: Math.round(box.distanceKm * 10) / 10,
      indoor: box.exposure === 'indoor',
      measures: measuresOf(box.sensors),
    }));
  return MESSAGES.nearby({ house: house.name, radiusKm, boxes });
}

/**
 * Read every configured box (unless read in the last minute) and report.
 * @param {import('./hub.js').Hub} hub
 * @param {ReturnType<import('./poller.js').createPoller>} poller
 * @param {object} config the normalized config
 */
export async function checkBoxes(hub, poller, config) {
  const ids = hub.boxIds(config);
  if (ids.length === 0 && config.invalidBoxIds.length === 0) {
    return TEXT.nothingConfigured;
  }
  await poller.refreshNow(ids, { maxAgeMs: 60_000 });
  const lines = ids.map((id) => {
    const record = hub.records.get(id);
    const result = hub.lastResults.get(id);
    const failed = result && !result.ok;
    return MESSAGES.checkBox({
      id,
      name: record?.name || '?',
      minutes: hub.ageMinutes(record),
      offline: hub.isOffline(record),
      measures: record ? measuresOf(record.features) : [],
      unknown: record?.unknown ?? [],
      error: failed ? result.error : null,
      notFound: failed && result.notFound,
    });
  });
  if (config.invalidBoxIds.length > 0) {
    lines.push(MESSAGES.invalidIds(config.invalidBoxIds));
  }
  if (config.droppedBoxIds.length > 0) {
    lines.push(MESSAGES.tooManyIds(config.boxIds.length));
  }
  return Object.fromEntries(
    Object.keys(lines[0]).map((lang) => [lang, lines.map((line) => line[lang]).join('\n')]),
  );
}
