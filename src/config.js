// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed with spaces, or invalid values.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, the ones every text carries. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The refresh intervals offered, in minutes. */
export const REFRESH_MINUTES = ['5', '10', '15', '30'];

/**
 * At most this many boxes are read: openSenseMap is a free service run by a
 * non-profit, and each box is one request per cycle.
 */
export const MAX_BOXES = 20;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  box_ids: '', // openSenseMap box ids, e.g. "5cd81adfff898b001ae7c4c6"
  refresh_minutes: '5', // how often the boxes are read
  language: 'fr', // language of the feature names and of the generated texts
};

/**
 * Merge the user config with the defaults and normalize every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const ids = parseBoxIds(raw.box_ids ?? DEFAULT_CONFIG.box_ids);
  const refresh = String(raw.refresh_minutes ?? DEFAULT_CONFIG.refresh_minutes).trim();
  const language = String(raw.language ?? DEFAULT_CONFIG.language).trim();
  return {
    boxIds: ids.valid.slice(0, MAX_BOXES),
    invalidBoxIds: ids.invalid,
    droppedBoxIds: ids.valid.slice(MAX_BOXES),
    refreshMinutes: REFRESH_MINUTES.includes(refresh)
      ? Number(refresh)
      : Number(DEFAULT_CONFIG.refresh_minutes),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

const BOX_ID = /^[0-9a-f]{24}$/;

/**
 * Split a typed list of box ids. Commas, semicolons and spaces separate them.
 * A link copied from the map (https://opensensemap.org/explore/<id>) gives
 * its id. Ids are lowercased, duplicates dropped, the order kept.
 * @param {unknown} text
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseBoxIds(text) {
  const valid = [];
  const invalid = [];
  for (const token of String(text).split(/[\s,;]+/)) {
    if (token === '') {
      continue;
    }
    const id = (/([0-9a-f]{24})\/?(?:[?#].*)?$/i.exec(token)?.[1] ?? token).toLowerCase();
    if (BOX_ID.test(id)) {
      if (!valid.includes(id)) {
        valid.push(id);
      }
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

/** The refresh period, in milliseconds. */
export function refreshPeriodMs(config) {
  return config.refreshMinutes * 60_000;
}
