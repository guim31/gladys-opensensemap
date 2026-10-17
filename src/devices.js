// -----------------------------------------------------------------------------
// The Gladys devices: one per openSenseMap box.
//
// External ids (forever, see CLAUDE.md):
//   device  : ext:<selector>:box:<box id>
//   feature : ext:<selector>:box:<box id>:<sensor id>   one per known sensor
//             ext:<selector>:box:<box id>:age           minutes since the last measurement
// Box and sensor ids are the 24-hex ids openSenseMap gives them: they survive
// a renamed box or sensor, so a renamed title never creates a new feature.
//
// The features of a device are the known sensors of its box: learnt from the
// API, kept under /data, and never removed (a feature is an external id
// Gladys keeps).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';
import { MEASURE_ORDER } from './phenomena.js';

const SENSOR = TYPES.SENSOR;

const decimal = (category, unit, min, max) => ({ category, type: SENSOR.DECIMAL, unit, min, max });
const integer = (category, unit, min, max) => ({ category, type: SENSOR.INTEGER, unit, min, max });

// The Gladys couple of each measure. Gladys has no PM1 category: PM1 is
// published as a PM2.5 sensor named "PM1", as in the Sensor.Community
// integration. min/max are display bounds (Gladys never clamps a state).
const FEATURES = {
  temperature: decimal(CATEGORIES.TEMPERATURE_SENSOR, UNITS.CELSIUS, -50, 80),
  soil_temperature: decimal(CATEGORIES.TEMPERATURE_SENSOR, UNITS.CELSIUS, -50, 80),
  humidity: decimal(CATEGORIES.HUMIDITY_SENSOR, UNITS.PERCENT, 0, 100),
  soil_moisture: decimal(CATEGORIES.SOIL_MOISTURE_SENSOR, UNITS.PERCENT, 0, 100),
  pressure: decimal(CATEGORIES.PRESSURE_SENSOR, UNITS.HECTO_PASCAL, 300, 1100),
  pm25: decimal(CATEGORIES.PM25_SENSOR, UNITS.MICROGRAM_PER_CUBIC_METER, 0, 1000),
  pm10: decimal(CATEGORIES.PM10_SENSOR, UNITS.MICROGRAM_PER_CUBIC_METER, 0, 1000),
  pm1: decimal(CATEGORIES.PM25_SENSOR, UNITS.MICROGRAM_PER_CUBIC_METER, 0, 1000),
  co2: integer(CATEGORIES.CO2_SENSOR, UNITS.PPM, 0, 10000),
  voc: decimal(CATEGORIES.VOC_SENSOR, UNITS.PPB, 0, 10000),
  noise: integer(CATEGORIES.NOISE_SENSOR, UNITS.DECIBEL, 0, 150),
  illuminance: decimal(CATEGORIES.LIGHT_SENSOR, UNITS.LUX, 0, 150000),
  uv_index: integer(CATEGORIES.UV_SENSOR, UNITS.UV_INDEX, 0, 15),
  wind_speed: decimal(CATEGORIES.SPEED_SENSOR, UNITS.KILOMETER_PER_HOUR, 0, 250),
  rain_rate: decimal(CATEGORIES.PRECIPITATION_SENSOR, UNITS.MILLIMETER_PER_HOUR, 0, 500),
  // A week shown on the scale; an older measurement still gets its real age.
  age: {
    category: CATEGORIES.DURATION,
    type: TYPES.DURATION.INTEGER,
    unit: UNITS.MINUTES,
    min: 0,
    max: 10080,
  },
};

/** Feature key of the measurement age. */
export const AGE_KEY = 'age';

/**
 * The external ids of the device of a box.
 * @param {object} gladys
 * @param {{ id: string }} record
 */
export function idsOf(gladys, record) {
  return gladys.externalIds('box', record.id);
}

/**
 * The known sensors of a record, in display order (then in box order).
 * @param {{ features: Array<{ key: string, measure: string }> }} record
 */
export function sortedFeatures(record) {
  const rank = (feature) => MEASURE_ORDER.indexOf(feature.measure);
  return record.features
    .map((feature, index) => ({ feature, index }))
    .sort((a, b) => rank(a.feature) - rank(b.feature) || a.index - b.index)
    .map(({ feature }) => feature);
}

/** The first sensor of a record measuring `measure`, or undefined. */
export function featureOf(record, measure) {
  return sortedFeatures(record).find((feature) => feature.measure === measure);
}

/** The device name: the name the owner gave the box, and the platform. */
export function deviceName(record) {
  const name = String(record.name ?? '').trim();
  return name ? `${name.slice(0, 60)} (openSenseMap)` : `openSenseMap ${record.id}`;
}

/**
 * The feature names of a record, by key: the measure in the configured
 * language; when a box measures the same thing twice, the second one gets
 * the owner's title (then its sensor model) to tell them apart.
 * @returns {Map<string, string>}
 */
export function featureNames(record, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const result = new Map();
  const taken = new Set([names.age]);
  for (const feature of sortedFeatures(record)) {
    const base = names[feature.measure];
    const candidates = [
      base,
      feature.title && `${base} (${feature.title})`,
      feature.sensorType && `${base} (${feature.title ?? ''}, ${feature.sensorType})`,
    ].filter(Boolean);
    let name = candidates.find((candidate) => !taken.has(candidate));
    for (let n = 2; !name; n += 1) {
      name = taken.has(`${base} ${n}`) ? null : `${base} ${n}`;
    }
    taken.add(name);
    result.set(feature.key, name);
  }
  return result;
}

function feature(gladys, record, key, measure, name) {
  return {
    name,
    external_id: idsOf(gladys, record).feature(key),
    ...FEATURES[measure],
    read_only: true,
    has_feedback: false,
    keep_history: true,
  };
}

/**
 * The discovery payload of one box.
 * @param {object} gladys
 * @param {object} record
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, record, language) {
  const names = featureNames(record, language);
  const features = sortedFeatures(record).map(({ key, measure }) =>
    feature(gladys, record, key, measure, names.get(key)),
  );
  features.push(feature(gladys, record, AGE_KEY, 'age', (NAMES[language] ?? NAMES.fr).age));
  return {
    name: deviceName(record),
    external_id: idsOf(gladys, record).device,
    model: record.model || 'senseBox',
    // The container reads the boxes itself (src/poller.js). These two fields
    // only keep the core's onPoll as a fallback: once a minute, the slowest
    // pace Gladys schedules, skipped while the container's timer runs.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features,
    params: [{ name: 'box_id', value: record.id }],
  };
}
