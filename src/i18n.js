// -----------------------------------------------------------------------------
// Every text the integration shows to the user, in the four languages of the
// Gladys interface (en, fr, de, es). German says "du", Spanish says "usted",
// like the rest of guim31's integrations. The vocabulary follows the Gladys
// interface (front/src/config/i18n).
//
//   - NAMES    : the feature names, in the language of the configuration
//                (Gladys freezes a name when the device is created);
//   - SHORT    : short labels of the measures (search results, summaries);
//   - TEXT     : fixed texts (widget, statuses);
//   - MESSAGES : texts built from values (action results, errors).
//
// test/i18n.test.js checks that every entry carries the four languages.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Feature names, by language then measure. */
export const NAMES = {
  en: {
    temperature: 'Temperature',
    humidity: 'Humidity',
    pressure: 'Pressure',
    pm25: 'PM2.5',
    pm10: 'PM10',
    pm1: 'PM1',
    co2: 'CO2',
    voc: 'VOC',
    noise: 'Noise',
    illuminance: 'Illuminance',
    uv_index: 'UV index',
    wind_speed: 'Wind speed',
    rain_rate: 'Rain rate',
    soil_moisture: 'Soil moisture',
    soil_temperature: 'Soil temperature',
    age: 'Measurement age',
  },
  fr: {
    temperature: 'Température',
    humidity: 'Humidité',
    pressure: 'Pression',
    pm25: 'PM2.5',
    pm10: 'PM10',
    pm1: 'PM1',
    co2: 'CO2',
    voc: 'COV',
    noise: 'Bruit',
    illuminance: 'Luminosité',
    uv_index: 'Indice UV',
    wind_speed: 'Vitesse du vent',
    rain_rate: 'Intensité de pluie',
    soil_moisture: 'Humidité du sol',
    soil_temperature: 'Température du sol',
    age: 'Âge de la mesure',
  },
  de: {
    temperature: 'Temperatur',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck',
    pm25: 'PM2.5',
    pm10: 'PM10',
    pm1: 'PM1',
    co2: 'CO2',
    voc: 'VOC',
    noise: 'Lärm',
    illuminance: 'Helligkeit',
    uv_index: 'UV-Index',
    wind_speed: 'Windgeschwindigkeit',
    rain_rate: 'Regenintensität',
    soil_moisture: 'Bodenfeuchte',
    soil_temperature: 'Bodentemperatur',
    age: 'Alter der Messung',
  },
  es: {
    temperature: 'Temperatura',
    humidity: 'Humedad',
    pressure: 'Presión',
    pm25: 'PM2.5',
    pm10: 'PM10',
    pm1: 'PM1',
    co2: 'CO2',
    voc: 'COV',
    noise: 'Ruido',
    illuminance: 'Luminosidad',
    uv_index: 'Índice UV',
    wind_speed: 'Velocidad del viento',
    rain_rate: 'Intensidad de lluvia',
    soil_moisture: 'Humedad del suelo',
    soil_temperature: 'Temperatura del suelo',
    age: 'Antigüedad de la medición',
  },
};

/** Units written after a value, by measure. */
export const UNIT_TEXT = {
  temperature: '°C',
  soil_temperature: '°C',
  humidity: '%',
  soil_moisture: '%',
  pressure: 'hPa',
  pm25: 'µg/m³',
  pm10: 'µg/m³',
  pm1: 'µg/m³',
  co2: 'ppm',
  voc: 'ppb',
  noise: 'dB',
  illuminance: 'lx',
  uv_index: '',
  wind_speed: 'km/h',
  rain_rate: 'mm/h',
};

/** Fixed texts. */
export const TEXT = {
  lastMeasurement: {
    en: 'Last measurement',
    fr: 'Dernière mesure',
    de: 'Letzte Messung',
    es: 'Última medición',
  },
  noData: { en: 'No data', fr: 'Aucune donnée', de: 'Keine Daten', es: 'Sin datos' },
  noBox: {
    en: 'Add a box in the Discovery tab of the integration to see its measurements here.',
    fr: "Ajoutez une boîte depuis l'onglet Découverte de l'intégration pour voir ici ses mesures.",
    de: 'Füge im Tab „Entdecken“ der Integration eine Box hinzu, um hier ihre Messungen zu sehen.',
    es: 'Añada una caja desde la pestaña Descubrimiento de la integración para ver aquí sus mediciones.',
  },
  unknownBox: {
    en: 'This box is no longer read: pick another one in the widget settings.',
    fr: "Cette boîte n'est plus lue : choisissez-en une autre dans les réglages du widget.",
    de: 'Diese Box wird nicht mehr gelesen: wähle in den Einstellungen des Widgets eine andere.',
    es: 'Esta caja ya no se lee: elija otra en los ajustes del widget.',
  },

  // Configuration screen
  notConfigured: {
    en: 'Enter the ids of the openSenseMap boxes to read.',
    fr: 'Saisissez les identifiants des boîtes openSenseMap à lire.',
    de: 'Gib die IDs der zu lesenden openSenseMap-Boxen ein.',
    es: 'Introduzca los identificadores de las cajas openSenseMap que desea leer.',
  },
  apiUnreachable: {
    en: 'The openSenseMap API does not answer: the readings will resume on their own.',
    fr: "L'API d'openSenseMap ne répond pas : les relevés reprendront d'eux-mêmes.",
    de: 'Die API von openSenseMap antwortet nicht: die Messungen laufen von selbst wieder an.',
    es: 'La API de openSenseMap no responde: las lecturas se reanudarán por sí solas.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, sieh dir die Logs der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  noHouse: {
    en: 'No house of Gladys has a location: set it in Settings → Houses.',
    fr: "Aucune maison de Gladys n'a de position : renseignez-la dans Paramètres → Maisons.",
    de: 'Kein Haus in Gladys hat einen Standort: lege ihn unter Einstellungen → Häuser fest.',
    es: 'Ninguna casa de Gladys tiene ubicación: indíquela en Ajustes → Casas.',
  },
  nothingConfigured: {
    en: 'Nothing to check: enter box ids first.',
    fr: "Rien à vérifier : saisissez d'abord des identifiants de boîtes.",
    de: 'Nichts zu prüfen: gib zuerst Box-IDs ein.',
    es: 'Nada que comprobar: introduzca primero identificadores de cajas.',
  },
  noReading: {
    en: 'No measurement of this box yet: wait for the first reading.',
    fr: "Aucune mesure de cette boîte pour l'instant : attendez le premier relevé.",
    de: 'Noch keine Messung dieser Box: warte auf die erste Abfrage.',
    es: 'Todavía no hay medición de esta caja: espere la primera lectura.',
  },
  unknownBoxAction: {
    en: 'This box is not read by the integration: check its id in the configuration.',
    fr: "Cette boîte n'est pas lue par l'intégration : vérifiez son identifiant dans la configuration.",
    de: 'Diese Box wird von der Integration nicht gelesen: prüfe ihre ID in der Konfiguration.',
    es: 'Esta caja no la lee la integración: compruebe su identificador en la configuración.',
  },
};

/** Multi-language object built by a function of the language. */
function build(render) {
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, render(lang)]));
}

/**
 * A number written the way the language writes it (decimal comma in French,
 * German and Spanish).
 */
export function formatNumber(value, lang, decimals = 1) {
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(value);
}

/** A duration in short words: "3 min", "2 h", "4 d". */
export function formatAge(minutes, lang) {
  const units = {
    en: ['min', 'h', 'd'],
    fr: ['min', 'h', 'j'],
    de: ['Min.', 'Std.', 'T.'],
    es: ['min', 'h', 'd'],
  }[lang];
  if (minutes < 120) {
    return `${Math.max(0, Math.round(minutes))} ${units[0]}`;
  }
  if (minutes < 48 * 60) {
    return `${Math.round(minutes / 60)} ${units[1]}`;
  }
  return `${Math.round(minutes / 1440)} ${units[2]}`;
}

/** A measured value with its unit: "17,8 °C", "PM2.5 2,5 µg/m³". */
export function formatValue(measure, value, lang) {
  const unit = UNIT_TEXT[measure];
  const text = formatNumber(value, lang);
  return unit ? `${text} ${unit}` : text;
}

const AGO = {
  en: (age) => `${age} ago`,
  fr: (age) => `il y a ${age}`,
  de: (age) => `vor ${age}`,
  es: (age) => `hace ${age}`,
};

const OFFLINE = {
  en: (age) => `Offline for ${age}`,
  fr: (age) => `Hors ligne depuis ${age}`,
  de: (age) => `Offline seit ${age}`,
  es: (age) => `Sin conexión desde hace ${age}`,
};

/** Texts built from values. */
export const MESSAGES = {
  /** "3 min ago", or "Offline for 5 h" when the box is silent. */
  measuredAgo: (minutes, offline) =>
    build((lang) => (offline ? OFFLINE : AGO)[lang](formatAge(minutes, lang))),

  /**
   * One-line summary of a box, for notifications:
   * "Saint-Simon Station: Température 17,8 °C · Humidité 99,9 % · il y a 3 min".
   * @param {{ name: string, values: Array<{ measure: string, value: number }>, minutes: number, offline: boolean }} summary
   */
  summary: ({ name, values, minutes, offline }) =>
    build((lang) => {
      const parts = offline
        ? []
        : values.map(
            ({ measure, value }) => `${NAMES[lang][measure]} ${formatValue(measure, value, lang)}`,
          );
      parts.push(MESSAGES.measuredAgo(minutes, offline)[lang]);
      return `${name}: ${parts.join(' · ')}`;
    }),

  invalidIds: (ids) =>
    build((lang) => {
      const list = ids.join(', ');
      return {
        en: `Ignored, not a box id: ${list}.`,
        fr: `Ignoré, ce n'est pas un identifiant de boîte : ${list}.`,
        de: `Ignoriert, keine Box-ID: ${list}.`,
        es: `Ignorado, no es un identificador de caja: ${list}.`,
      }[lang];
    }),

  tooManyIds: (max) =>
    build(
      (lang) =>
        ({
          en: `Only the first ${max} boxes are read.`,
          fr: `Seules les ${max} premières boîtes sont lues.`,
          de: `Nur die ersten ${max} Boxen werden gelesen.`,
          es: `Solo se leen las ${max} primeras cajas.`,
        })[lang],
    ),

  /** One line of the check report. */
  checkBox: ({ id, name, minutes, offline, measures, unknown, error, notFound }) =>
    build((lang) => {
      if (notFound) {
        return {
          en: `${id}: no such box on openSenseMap`,
          fr: `${id} : boîte inconnue d'openSenseMap`,
          de: `${id}: keine solche Box auf openSenseMap`,
          es: `${id}: caja desconocida en openSenseMap`,
        }[lang];
      }
      if (error) {
        return {
          en: `${id}: error (${error})`,
          fr: `${id} : erreur (${error})`,
          de: `${id}: Fehler (${error})`,
          es: `${id}: error (${error})`,
        }[lang];
      }
      const age =
        minutes === null ? TEXT.noData[lang] : MESSAGES.measuredAgo(minutes, offline)[lang];
      const known = measures.map((measure) => NAMES[lang][measure]).join(', ');
      let line = `${name} (${id}): ${age} · ${known || TEXT.noData[lang]}`;
      if (unknown.length > 0) {
        const ignored = { en: 'ignored', fr: 'ignorés', de: 'ignoriert', es: 'ignorados' }[lang];
        line += ` · ${ignored}: ${unknown.join(', ')}`;
      }
      return line;
    }),

  /** Result of the nearby search. */
  nearby: ({ house, radiusKm, boxes }) =>
    build((lang) => {
      const radius = formatNumber(radiusKm, lang);
      if (boxes.length === 0) {
        return {
          en: `No box measured within ${radius} km of "${house}" in the last 24 hours: try a wider radius.`,
          fr: `Aucune boîte n'a mesuré à moins de ${radius} km de « ${house} » ces dernières 24 heures : essayez un rayon plus grand.`,
          de: `Keine Box im Umkreis von ${radius} km um „${house}“ hat in den letzten 24 Stunden gemessen: versuch einen größeren Radius.`,
          es: `Ninguna caja ha medido a menos de ${radius} km de «${house}» en las últimas 24 horas: pruebe un radio mayor.`,
        }[lang];
      }
      const indoor = { en: 'indoor', fr: 'intérieur', de: 'innen', es: 'interior' }[lang];
      const lines = boxes.map(
        (box) =>
          `${box.id} · ${box.name} · ${formatNumber(box.distanceKm, lang)} km` +
          `${box.indoor ? ` · ${indoor}` : ''} · ${box.measures.map((m) => NAMES[lang][m]).join(', ')}`,
      );
      const ids = boxes.map((box) => box.id).join(', ');
      const head = {
        en: `${boxes.length} box(es) within ${radius} km of "${house}", nearest first:`,
        fr: `${boxes.length} boîte(s) à moins de ${radius} km de « ${house} », de la plus proche à la plus loin :`,
        de: `${boxes.length} Box(en) im Umkreis von ${radius} km um „${house}“, die nächste zuerst:`,
        es: `${boxes.length} caja(s) a menos de ${radius} km de «${house}», de la más cercana a la más lejana:`,
      }[lang];
      const tail = {
        en: `Copy the ids you want into "Box ids": ${ids}`,
        fr: `Copiez les identifiants voulus dans « Identifiants des boîtes » : ${ids}`,
        de: `Kopiere die gewünschten IDs in „Box-IDs“: ${ids}`,
        es: `Copie los identificadores deseados en «Identificadores de las cajas»: ${ids}`,
      }[lang];
      return [head, ...lines, tail].join('\n');
    }),

  /** A thrown error: the core shows it as is, so every language is joined. */
  thrown: (text) => LANGUAGES.map((lang) => text[lang]).join(' / '),
};
