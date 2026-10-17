// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client: the real one (index.js) or the
// SDK's fake Gladys (tests). Every handler is registered here, before
// connect().
//
//   connected       -> config, boxes known from /data, then a first read
//   poller          -> reads the boxes on its own timer (src/poller.js)
//   onPoll          -> fallback of the timer
//   onDeviceCreated -> the states of the new device, now
//   actions         -> nearby search, check (src/actions.js)
//   scene action    -> get_measurements (src/scenes.js)
//   scene triggers  -> box_offline, box_back_online (src/hub.js)
//   widget          -> box_measurements (src/widgets.js)
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { Hub } from './hub.js';
import { Store } from './store.js';
import { createPoller } from './poller.js';
import { ACTION, checkBoxes, findNearby } from './actions.js';
import { GET_MEASUREMENTS, getMeasurements } from './scenes.js';
import { WIDGET_KEY, buildBoxContent } from './widgets.js';
import { TEXT } from './i18n.js';

const logger = createLogger({ name: 'opensensemap' });

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {{ load: Function, save: Function, flush?: Function }} [options.store]
 * @param {typeof fetch} [options.fetch]
 * @param {boolean} [options.timers] run the polling timer
 * @param {() => number} [options.now]
 */
export function registerHandlers(gladys, { store = new Store(), fetch, timers = true, now } = {}) {
  let config = normalizeConfig();
  const getConfig = () => config;
  const hub = new Hub({ gladys, getConfig, store, fetch, now });
  const ready = hub.load();
  let lastStatus = null;

  const poller = createPoller({ gladys, hub, getConfig, afterCycle, timers, now });

  /** Publish what the last reads changed: devices, /data, status, widget. */
  async function afterCycle() {
    if (hub.devicesChanged) {
      hub.devicesChanged = false;
      await publishDevices();
    }
    await hub.save();
    await updateStatus();
    if (hub.widgetChanged) {
      hub.widgetChanged = false;
      gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(hub.buildDevices(config));
  }

  /** The status of the Configuration screen, sent when it changes. */
  async function updateStatus() {
    let status = { connected: true };
    if (hub.boxIds(config).length === 0) {
      status = { connected: false, message: TEXT.notConfigured };
    } else if (hub.apiDown(config)) {
      status = { connected: false, message: TEXT.apiUnreachable };
    }
    const key = JSON.stringify(status);
    if (key !== lastStatus) {
      lastStatus = key;
      await gladys.setConnectionStatus(status.connected, status.message);
    }
  }

  function logConfig() {
    logger.info(`Reading ${config.boxIds.length} box(es) every ${config.refreshMinutes} min`);
    if (config.invalidBoxIds.length > 0) {
      logger.warn(`Ignored, not box ids: ${config.invalidBoxIds.join(', ')}`);
    }
    if (config.droppedBoxIds.length > 0) {
      logger.warn(`Too many boxes: ${config.droppedBoxIds.join(', ')} not read`);
    }
  }

  async function start() {
    await ready;
    hub.prune(config);
    // The boxes known from /data first: the Discovery tab is complete even
    // before the first read, or while the API is down.
    await publishDevices();
    await updateStatus();
    await poller.restart();
  }

  // --- Connection lifecycle ----------------------------------------------------
  // The SDK logs the WebSocket lifecycle itself.
  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      logConfig();
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    // Nothing reaches Gladys while it is away: the status is sent again on return.
    lastStatus = null;
  });

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    config = normalizeConfig(raw);
    logConfig();
    await start();
  });

  // --- Discovery -----------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await ready;
    // A box never read yet is read now, so the list shows it.
    const unread = hub.boxIds(config).filter((id) => !hub.records.has(id));
    if (unread.length > 0) {
      await poller.refreshNow(unread);
    }
    await publishDevices();
  });

  // --- Polling: the timer's fallback --------------------------------------------
  gladys.onPoll((device) => poller.pollFromCore(device));

  // --- A device added (or updated) in Gladys: its states now ---------------------
  // The core dropped the states sent before the device existed, and the SDK
  // forgot them: send everything again (a read when the last one is older
  // than a minute), and nudge the widget, which can now show it.
  async function onDeviceAdded(device) {
    await ready;
    const record = hub.recordByDevice(device.external_id);
    if (!record) {
      return;
    }
    // Everything goes out once: by the read when there is one, else here.
    hub.resend.add(record.id);
    await poller.refreshNow([record.id], { maxAgeMs: 60_000 });
    await hub.publishStates(record);
    gladys.requestWidgetRefresh(WIDGET_KEY);
  }
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(async () => {
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });

  // --- Configuration screen buttons ---------------------------------------------
  gladys.onAction(ACTION.FIND_NEARBY, async (fields) => {
    logger.info('Action: search for nearby boxes');
    return findNearby(gladys, fields ?? {}, { fetch, now });
  });

  gladys.onAction(ACTION.CHECK_BOXES, async () => {
    logger.info('Action: check the boxes');
    await ready;
    return checkBoxes(hub, poller, config);
  });

  // --- Scene action ---------------------------------------------------------------
  gladys.onSceneAction(GET_MEASUREMENTS, async (fields) => {
    await ready;
    return getMeasurements(hub, fields ?? {}, config.language);
  });

  // --- Dashboard widget -----------------------------------------------------------
  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    await ready;
    return buildBoxContent({ hub, gladys, settings, language });
  });

  return {
    hub,
    poller,
    ready,
    getConfig,
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      poller.stop();
      await store.flush?.();
    },
  };
}
