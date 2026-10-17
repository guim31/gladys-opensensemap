// -----------------------------------------------------------------------------
// Scene action "Get the measurements of a box" (Gladys 5.1+).
//
// Gives a scene the last measurements of a box as outputs a notification can
// quote: "{{...summary}}" reads "Saint-Simon Station: Temperature 17.8 °C ·
// Humidity 99.9 % · 3 min ago". The devices already give each value to the
// scene conditions; what this action adds is a ready-made sentence in the
// configured language, and the age of the measurement.
//
// The triggers "Box offline" and "Box back online" are fired by the hub
// (src/hub.js).
// -----------------------------------------------------------------------------

import { MESSAGES, TEXT } from './i18n.js';
import { featureOf, sortedFeatures } from './devices.js';

export const GET_MEASUREMENTS = 'get_measurements';

/** The measures given as outputs of their own. */
const OUTPUTS = ['temperature', 'humidity', 'pressure', 'pm25', 'pm10'];

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ box?: string }} fields
 * @param {string} language
 */
export function getMeasurements(hub, fields, language) {
  const record = fields.box ? hub.recordByDevice(fields.box) : undefined;
  if (!record) {
    throw new Error(MESSAGES.thrown(TEXT.unknownBoxAction));
  }
  const minutes = hub.ageMinutes(record);
  if (minutes === null) {
    throw new Error(MESSAGES.thrown(TEXT.noReading));
  }
  const offline = hub.isOffline(record);
  // The first sensor of each measure, fresh values only.
  const seen = new Set();
  const values = [];
  for (const feature of sortedFeatures(record)) {
    const value = hub.freshValue(record, feature.key);
    if (value !== undefined && !seen.has(feature.measure)) {
      seen.add(feature.measure);
      values.push({ measure: feature.measure, value });
    }
  }
  const outputs = {
    summary: MESSAGES.summary({ name: hub.nameOf(record), values, minutes, offline })[language],
    age_minutes: minutes,
  };
  for (const measure of OUTPUTS) {
    const feature = featureOf(record, measure);
    const value = feature && hub.freshValue(record, feature.key);
    if (value !== undefined) {
      outputs[measure] = value;
    }
  }
  return outputs;
}
