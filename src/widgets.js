// -----------------------------------------------------------------------------
// The "Box measurements" dashboard widget (Gladys 5.1+).
//
// With a box chosen in its settings: up to six live tiles (bound to the device
// features, so they follow every state) and the time of the last measurement,
// red when the box is offline. Without one: one row per added box, with how
// long ago it measured.
//
// The content is built from what the integration already read: showing the
// widget never calls the API. The core caches it per (settings, language,
// units), so the texts are localized in the language it asks for.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { MESSAGES, NAMES, TEXT } from './i18n.js';
import { idsOf, sortedFeatures } from './devices.js';
import { LANGUAGES } from './config.js';

export const WIDGET_KEY = 'box_measurements';

/** Seconds the core keeps a content: the age row moves by the minute. */
const TTL_SECONDS = 120;

/** Tiles of the single-box view (budget of the core: 8 components). */
const MAX_TILES = 6;

/** Rows of the overview. */
const MAX_ROWS = 10;

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The freshness row of a box: green when it measured recently, red when offline. */
function ageItem(hub, record, label, language) {
  const minutes = hub.ageMinutes(record);
  if (minutes === null) {
    return { label, value: TEXT.noData[language], color: WIDGET_COLORS.NEUTRAL };
  }
  const offline = hub.isOffline(record);
  return {
    label,
    value: clip(MESSAGES.measuredAgo(minutes, offline)[language], 40),
    color: offline ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
    icon: offline ? 'wifi-off' : 'clock',
  };
}

/**
 * The widget content.
 * @param {object} options
 * @param {import('./hub.js').Hub} options.hub
 * @param {object} options.gladys
 * @param {{ box?: string }} [options.settings]
 * @param {string} [options.language]
 */
export function buildBoxContent({ hub, gladys, settings = {}, language = 'en' }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';

  if (settings.box) {
    const record = hub.recordByDevice(settings.box);
    if (!record) {
      return {
        ttl_seconds: TTL_SECONDS,
        components: [{ type: 'text', text: TEXT.unknownBox[lang] }],
      };
    }
    const ids = idsOf(gladys, record);
    // One tile per measure (the first sensor of each), in display order.
    const seen = new Set();
    const tiles = [];
    for (const feature of sortedFeatures(record)) {
      if (!seen.has(feature.measure) && tiles.length < MAX_TILES) {
        seen.add(feature.measure);
        tiles.push({
          type: 'value',
          label: NAMES[lang][feature.measure],
          device_feature: ids.feature(feature.key),
        });
      }
    }
    return {
      ttl_seconds: TTL_SECONDS,
      components: [
        ...tiles,
        { type: 'status', items: [ageItem(hub, record, TEXT.lastMeasurement[lang], lang)] },
      ],
    };
  }

  const created = hub.configuredRecords().filter((record) => hub.isCreated(record));
  if (created.length === 0) {
    return { ttl_seconds: TTL_SECONDS, components: [{ type: 'text', text: TEXT.noBox[lang] }] };
  }
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'status',
        items: created
          .slice(0, MAX_ROWS)
          .map((record) => ageItem(hub, record, clip(hub.nameOf(record), 40), lang)),
      },
    ],
  };
}
