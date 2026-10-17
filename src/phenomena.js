// -----------------------------------------------------------------------------
// What a sensor of a box measures, read from its title and unit.
//
// openSenseMap lets each owner name the sensors of a box: the senseBox
// templates write German titles ("Temperatur", "rel. Luftfeuchte",
// "Beleuchtungsstärke"), the airRohr import other German titles, custom boxes
// anything ("Temperature", "Temp ~ Air", "CO₂"). The icon is no better (a
// noise sensor with a thermometer icon is in the fixtures). So a measure is
// recognized by its unit first, and by its title when the unit is shared
// (°C, %, ppm, m/s...). A sensor this table does not know is left out: no
// device feature, it is listed by the "Check the boxes" action.
//
// Values are converted to the unit Gladys offers for the category: a pressure
// in Pa (airRohr import) becomes hPa, a wind speed in m/s km/h. UV in µW/cm² (senseBox VEML6070) has no
// Gladys unit, and no reliable conversion to a UV index: left out.
// -----------------------------------------------------------------------------

/** Display order of the measures (device features, widget, summaries). */
export const MEASURE_ORDER = [
  'temperature',
  'humidity',
  'pressure',
  'pm25',
  'pm10',
  'pm1',
  'co2',
  'voc',
  'noise',
  'illuminance',
  'uv_index',
  'wind_speed',
  'rain_rate',
  'soil_moisture',
  'soil_temperature',
];

const has = (pattern) => (title) => pattern.test(title);
const SOIL = /boden|soil|\bsol\b|suelo/i;
const anyTitle = () => true;

// Normalized units (lowercase, no space, µ unified) → the rules that may use them.
// Each rule: measure, a title test, and the conversion to the Gladys unit.
const RULES = {
  '°c': [
    { measure: 'soil_temperature', title: has(SOIL) },
    { measure: 'temperature', title: anyTitle },
  ],
  '℃': [{ measure: 'temperature', title: anyTitle }],
  '%': [
    { measure: 'soil_moisture', title: has(SOIL) },
    { measure: 'humidity', title: has(/feucht|humid|humed|hygro/i) },
  ],
  pa: [{ measure: 'pressure', title: anyTitle, convert: (value) => value / 100 }],
  hpa: [{ measure: 'pressure', title: anyTitle }],
  mbar: [{ measure: 'pressure', title: anyTitle }],
  kpa: [{ measure: 'pressure', title: anyTitle, convert: (value) => value * 10 }],
  'µg/m³': [
    { measure: 'pm10', title: has(/pm\s*10(?![.,\d])/i) },
    { measure: 'pm25', title: has(/pm\s*2[.,]?5/i) },
    { measure: 'pm1', title: has(/pm\s*1(?:[.,]0)?(?![.,\d])/i) },
  ],
  ppm: [{ measure: 'co2', title: has(/co2|co₂|kohlendioxid|carbon dioxide/i) }],
  ppb: [{ measure: 'voc', title: has(/voc|cov\b|tvoc/i) }],
  lx: [{ measure: 'illuminance', title: anyTitle }],
  lux: [{ measure: 'illuminance', title: anyTitle }],
  db: [{ measure: 'noise', title: anyTitle }],
  'db(a)': [{ measure: 'noise', title: anyTitle }],
  dba: [{ measure: 'noise', title: anyTitle }],
  'm/s': [
    {
      measure: 'wind_speed',
      title: has(/wind|vent|viento|böe|gust/i),
      convert: (value) => value * 3.6,
    },
  ],
  'km/h': [{ measure: 'wind_speed', title: has(/wind|vent|viento|böe|gust/i) }],
  'mm/h': [{ measure: 'rain_rate', title: anyTitle }],
};

/** UV index: a dimensionless unit, so the title decides. */
const UV_INDEX_TITLE = /uv.?index|\buvi\b/i;
const UV_INDEX_UNITS = new Set(['', '-', 'uvi', 'index', 'uv-index', 'uvindex']);

/** A unit as written by the owners, comparable: "dB (A)" → "db(a)", "μg/m3" → "µg/m³". */
export function normalizeUnit(unit) {
  return String(unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[μu]g\/m(3|³|\^3)/, 'µg/m³')
    .replace(/^°?celsius$|^grad$/, '°c');
}

/**
 * The measure of a sensor, or null when the integration does not know it.
 * @param {{ title?: string, unit?: string }} sensor
 * @returns {{ measure: string, convert: (value: number) => number } | null}
 */
export function classify(sensor) {
  const title = String(sensor?.title ?? '');
  const unit = normalizeUnit(sensor?.unit);
  if (UV_INDEX_TITLE.test(title) && UV_INDEX_UNITS.has(unit)) {
    return { measure: 'uv_index', convert: (value) => value };
  }
  for (const rule of RULES[unit] ?? []) {
    if (rule.title(title)) {
      return { measure: rule.measure, convert: rule.convert ?? ((value) => value) };
    }
  }
  return null;
}

/** Decimals kept per measure (the rest is sensor noise). */
const DECIMALS = { pressure: 1, illuminance: 0, co2: 0, noise: 0, uv_index: 0 };

/**
 * The value Gladys gets for a raw measurement, or null when it is not a number.
 * @param {string} measure
 * @param {(value: number) => number} convert
 * @param {unknown} raw the API sends values as strings ("17.80")
 */
export function toValue(measure, convert, raw) {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const number = Number(raw);
  if (!Number.isFinite(number)) {
    return null;
  }
  const factor = 10 ** (DECIMALS[measure] ?? 2);
  return Math.round(convert(number) * factor) / factor;
}
