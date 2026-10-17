// -----------------------------------------------------------------------------
// The boxes the integration reads, what it knows about them, and what it
// publishes to Gladys.
//
// Reading a box updates its "record" (name, known sensors, last values and
// their times), persisted under /data; the record gives the Gladys device
// (src/devices.js) and its states.
//
// Freshness: openSenseMap always answers the LAST measurement of each sensor,
// however old. A value older than STALE_MINUTES is not published: a value
// Gladys shows as recent is a recent measurement. Only the measurement age
// keeps moving, so a scene or the widget can tell a silent box.
//
// Offline triggers: when the age of a box crosses 1, 3, 6, 12, 24 or 48 hours,
// "Box offline" fires once per step; its first fresh measurement after one of
// them fires "Box back online". Only after a successful read of the API: an
// openSenseMap outage is not a box going offline.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { fetchBox, ApiError } from './api.js';
import { AGE_KEY, buildDevice, deviceName, idsOf } from './devices.js';
import { createIssueLog } from './issues.js';

const logger = createLogger({ name: 'boxes' });

/** Past this age, a measurement is stale and the box shown offline. */
export const STALE_MINUTES = 60;

/** The steps of the "Box offline" trigger, in hours (the values of its `hours` field). */
export const OFFLINE_HOURS = [1, 3, 6, 12, 24, 48];

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/** Keys of the scene triggers. */
export const TRIGGER = {
  BOX_OFFLINE: 'box_offline',
  BOX_BACK_ONLINE: 'box_back_online',
};

const STORE_VERSION = 1;

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch };
    this.now = now;
    /** Record by box id. */
    this.records = new Map();
    /** Set when the device list must be published again (new box, new sensor). */
    this.devicesChanged = false;
    /** Set when the widget content changed (online/offline). */
    this.widgetChanged = false;
    /** Boxes whose values must all be sent again (back from silence). */
    this.resend = new Set();
    /** Scene events waiting for the publication of their box's states. */
    this.pendingEvents = new Map();
    /** Outcome of the last read of each box: { ok, error?, notFound?, at }. */
    this.lastResults = new Map();
    this.issues = createIssueLog(logger);
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    for (const record of data.records ?? []) {
      if (record && typeof record.id === 'string' && Array.isArray(record.features)) {
        record.values ??= {};
        record.valueAt ??= {};
        this.records.set(record.id, record);
      }
    }
  }

  persist() {
    return this.store.save({ version: STORE_VERSION, records: [...this.records.values()] });
  }

  /** The configured box ids. */
  boxIds(config = this.getConfig()) {
    return config.boxIds;
  }

  /** The records of the configured boxes that were read once, in configuration order. */
  configuredRecords(config = this.getConfig()) {
    return this.boxIds(config)
      .map((id) => this.records.get(id))
      .filter(Boolean);
  }

  /** The record behind a device external id, among the configured ones. */
  recordByDevice(externalId, config = this.getConfig()) {
    return this.configuredRecords(config).find(
      (record) => idsOf(this.gladys, record).device === externalId,
    );
  }

  /** The discovery payload: one device per configured box read once. */
  buildDevices(config = this.getConfig()) {
    return this.configuredRecords(config).map((record) =>
      buildDevice(this.gladys, record, config.language),
    );
  }

  /** The device of a record in Gladys, if the user added it. */
  createdDevice(record) {
    const external = idsOf(this.gladys, record).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === external);
  }

  isCreated(record) {
    return Boolean(this.createdDevice(record));
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(record) {
    return this.createdDevice(record)?.name || deviceName(record);
  }

  /** Minutes since the last measurement of a box, null when there never was one. */
  ageMinutes(record) {
    if (!record?.lastMeasurementAt) {
      return null;
    }
    return Math.max(0, Math.floor((this.now() - record.lastMeasurementAt) / 60_000));
  }

  /** True when the box sent nothing for STALE_MINUTES (or never). */
  isOffline(record) {
    const minutes = this.ageMinutes(record);
    return minutes === null || minutes > STALE_MINUTES;
  }

  /** The fresh value of a sensor, undefined when absent or stale. */
  freshValue(record, key) {
    const at = record.valueAt[key];
    const value = record.values[key];
    if (typeof value !== 'number' || !at || this.now() - at > STALE_MINUTES * 60_000) {
      return undefined;
    }
    return value;
  }

  /**
   * Read one box and publish what changed. Throws the read error (the poller
   * logs it), after recording it for the check action.
   * @param {string} id box id
   */
  async refresh(id) {
    let box;
    try {
      box = await fetchBox(id, this.deps);
      this.issues.ok('api', 'openSenseMap API answers again');
      this.issues.ok(`box:${id}`, `Box ${id} found again`);
    } catch (err) {
      const notFound = err instanceof ApiError && err.status === 404;
      if (notFound) {
        this.issues.fail(`box:${id}`, `Box ${id} not found on openSenseMap: check its id`);
      } else if (err instanceof ApiError) {
        this.issues.fail('api', err.message);
      }
      this.lastResults.set(id, { ok: false, error: err.message, notFound, at: this.now() });
      throw err;
    }
    this.lastResults.set(id, { ok: true, at: this.now() });
    const record = this.apply(box);
    await this.publishStates(record);
    return record;
  }

  /** Merge a box answer into its record. */
  apply(box) {
    let record = this.records.get(box.id);
    if (!record) {
      record = { id: box.id, features: [], values: {}, valueAt: {}, lastMeasurementAt: null };
      this.records.set(box.id, record);
      this.devicesChanged = true;
      logger.info(
        `Box ${box.id} found: "${box.name}" (${box.sensors.map((s) => s.measure).join(', ') || 'no known sensor'})`,
      );
    }
    record.name = box.name;
    record.model = box.model;
    record.exposure = box.exposure;
    record.location = box.location;
    record.unknown = box.unknown;

    const added = [];
    for (const sensor of box.sensors) {
      const known = record.features.find((feature) => feature.key === sensor.key);
      if (!known) {
        const { key, measure, title, sensorType } = sensor;
        record.features.push({ key, measure, title, sensorType });
        added.push(measure);
      } else {
        // A title edited by the owner: kept for the names of features added later.
        known.title = sensor.title;
        known.sensorType = sensor.sensorType;
      }
      const previous = record.valueAt[sensor.key];
      if (
        sensor.value !== null &&
        sensor.measuredAt &&
        (!previous || sensor.measuredAt > previous)
      ) {
        record.values[sensor.key] = sensor.value;
        record.valueAt[sensor.key] = sensor.measuredAt;
      }
    }
    if (added.length > 0) {
      this.devicesChanged = true;
      if (record.features.length > added.length) {
        logger.info(`Box ${box.id} also measures ${added.join(', ')}`);
      }
    }

    const newest = Math.max(
      box.lastMeasurementAt ?? 0,
      ...box.sensors.map((sensor) => sensor.measuredAt ?? 0),
    );
    if (newest > (record.lastMeasurementAt ?? 0)) {
      if (record.lastMeasurementAt && this.isOffline(record)) {
        // Back from silence: every value goes out again, even an unchanged
        // one, so Gladys dates it now.
        this.resend.add(record.id);
        record.lastGapMinutes = Math.round((newest - record.lastMeasurementAt) / 60_000);
      }
      record.lastMeasurementAt = newest;
    }
    this.persistNeeded = true;
    this.watchOffline(record);
    return record;
  }

  /** Log (once) a box that went silent and its return; queue the scene events. */
  watchOffline(record) {
    const minutes = this.ageMinutes(record);
    if (minutes === null) {
      return;
    }
    const offline = this.isOffline(record);
    const key = `offline:${record.id}`;
    if (offline !== this.issues.isFailing(key)) {
      this.widgetChanged = true;
    }
    if (offline) {
      this.issues.fail(key, `${deviceName(record)}: no measurement for ${minutes} min`);
    } else {
      this.issues.ok(key, `${deviceName(record)}: measurements again`);
    }

    const step = OFFLINE_HOURS.filter((hours) => minutes >= hours * 60).pop() ?? 0;
    const previous = record.offlineStep;
    record.offlineStep = step;
    // The first look at a box, or a box not added to Gladys: no event (a box
    // already silent for days at install time is no news).
    if (previous === undefined || previous === null || !this.isCreated(record)) {
      return;
    }
    const device = idsOf(this.gladys, record).device;
    const events = [];
    for (const hours of OFFLINE_HOURS.filter((h) => h > previous && h <= step)) {
      events.push({
        key: TRIGGER.BOX_OFFLINE,
        data: {
          device,
          box_name: this.nameOf(record),
          hours: String(hours),
          offline_minutes: minutes,
          last_measurement: new Date(record.lastMeasurementAt).toISOString(),
        },
      });
    }
    if (previous > 0 && step === 0) {
      events.push({
        key: TRIGGER.BOX_BACK_ONLINE,
        data: {
          device,
          box_name: this.nameOf(record),
          offline_minutes: record.lastGapMinutes ?? null,
        },
      });
    }
    if (events.length > 0) {
      this.pendingEvents.set(record.id, [...(this.pendingEvents.get(record.id) ?? []), ...events]);
    }
  }

  /**
   * Publish the states of a box whose device exists in Gladys: its fresh
   * values and always its age. Only the changes go out (the SDK
   * deduplicates), plus a heartbeat. Then the scene events of the box.
   * @param {object} record
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(record, { force = false } = {}) {
    const events = this.pendingEvents.get(record.id) ?? [];
    this.pendingEvents.delete(record.id);
    if (!this.isCreated(record)) {
      return;
    }
    const ids = idsOf(this.gladys, record);
    if (force || this.resend.has(record.id)) {
      this.resend.delete(record.id);
      this.gladys.forgetPublishedStates(ids.device);
    }
    const states = [];
    for (const feature of record.features) {
      const value = this.freshValue(record, feature.key);
      if (value !== undefined) {
        states.push({ device_feature_external_id: ids.feature(feature.key), state: value });
      }
    }
    const minutes = this.ageMinutes(record);
    if (minutes !== null) {
      states.push({ device_feature_external_id: ids.feature(AGE_KEY), state: minutes });
    }
    if (states.length > 0) {
      await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
    }
    for (const event of events) {
      logger.info(
        event.key === TRIGGER.BOX_OFFLINE
          ? `${deviceName(record)}: offline for ${event.data.hours} h`
          : `${deviceName(record)}: back online`,
      );
      await this.gladys.publishSceneEvent(event.key, event.data);
    }
  }

  /** Forget the records of the boxes no longer configured. */
  prune(config = this.getConfig()) {
    const kept = new Set(this.boxIds(config));
    for (const id of this.records.keys()) {
      if (!kept.has(id)) {
        this.records.delete(id);
        this.persistNeeded = true;
      }
    }
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded) {
      this.persistNeeded = false;
      await this.persist();
    }
  }
}
