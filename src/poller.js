// -----------------------------------------------------------------------------
// The container's own polling timer.
//
// The devices are published with `should_poll: true` and a valid
// `poll_frequency`, but the core cannot be trusted to call onPoll: Gladys
// 5.2.x skips devices created without `should_poll`, and a device keeps the
// polling fields it was created with (GladysAssistant/Gladys#3198). So the
// container reads the boxes by itself, and the core's onPoll is a fallback.
//
// Pace: every `refresh_minutes` (5 minutes at least). One timer ticks every
// minute and reads the boxes that are due; a box read less than 90 % of the
// period ago is skipped, whoever asks (timer or core), so the core's minute
// polls never add a request to the API while the timer runs.
//
// What is read: the boxes whose device the user added to Gladys, and the
// boxes never read yet (their first answer gives the device for the
// Discovery tab). One box after the other: a free service, no burst.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { refreshPeriodMs } from './config.js';

const logger = createLogger({ name: 'poller' });

/** The timer's tick. */
export const TICK_MS = 60_000;

/** A box read less than this share of the period ago is not read again. */
const MIN_GAP = 0.9;

/**
 * @param {object} options
 * @param {object} options.gladys
 * @param {import('./hub.js').Hub} options.hub
 * @param {() => object} options.getConfig
 * @param {() => Promise<void>} options.afterCycle publishes what the reads changed
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {() => number} [options.now]
 */
export function createPoller({
  gladys,
  hub,
  getConfig,
  afterCycle = async () => {},
  timers = true,
  now = () => Date.now(),
}) {
  /** When each box was last read (start of the read), by box id. */
  const lastReadAt = new Map();
  /** Reads in progress, by box id: a second caller waits for the same one. */
  const inFlight = new Map();
  let timer = null;
  let stopped = true;

  /** The boxes to read now: added to Gladys, or never read. */
  function wantedBoxes(config) {
    return hub.boxIds(config).filter((id) => {
      const record = hub.records.get(id);
      return !record || hub.isCreated(record);
    });
  }

  /**
   * Read one box, unless it was read less than MIN_GAP of the period ago
   * (force: read anyway, after the read in progress if any).
   * @returns {Promise<boolean>} true when the box was read
   */
  async function readBox(id, { force = false } = {}) {
    let running = inFlight.get(id);
    while (running && force) {
      await running.catch(() => {});
      running = inFlight.get(id);
    }
    if (running) {
      await running.catch(() => {});
      return false;
    }
    const last = lastReadAt.get(id);
    if (!force && last !== undefined && now() - last < refreshPeriodMs(getConfig()) * MIN_GAP) {
      logger.debug(`${id}: read ${Math.round((now() - last) / 1000)} s ago, skipped`);
      return false;
    }
    lastReadAt.set(id, now());
    const run = hub.refresh(id);
    inFlight.set(id, run);
    try {
      await run;
      return true;
    } catch (err) {
      // Logged once by the hub's issue log; the next read retries.
      logger.debug(`${id}: ${err.message}`);
      return true;
    } finally {
      inFlight.delete(id);
    }
  }

  /** One cycle: the wanted boxes, in sequence. */
  async function cycle({ force = false, ids } = {}) {
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: cycle skipped');
      return;
    }
    for (const id of ids ?? wantedBoxes(getConfig())) {
      await readBox(id, { force });
    }
    await afterCycle();
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Polling cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  return {
    /** (Re)start: read every wanted box now, then on the timer. */
    async restart() {
      stopped = false;
      schedule();
      await cycle({ force: true });
    },

    /** One timer cycle (tests). */
    cycle,

    /**
     * The core's onPoll (fallback): read the device's box unless it was read
     * recently.
     * @param {{ external_id: string }} device
     */
    async pollFromCore(device) {
      const record = hub.recordByDevice(device.external_id);
      if (!record) {
        logger.debug(`onPoll ignored (not a configured box): ${device.external_id}`);
        return;
      }
      if (await readBox(record.id)) {
        await afterCycle();
      }
    },

    /**
     * Read some boxes now (a device just added, the check action), unless
     * they were read less than `maxAgeMs` ago.
     */
    async refreshNow(ids, { maxAgeMs = 0 } = {}) {
      const due = ids.filter((id) => {
        const last = lastReadAt.get(id);
        return last === undefined || now() - last >= maxAgeMs;
      });
      await cycle({ force: true, ids: due });
    },

    /** When a box was last read, undefined if never. */
    lastReadAt: (id) => lastReadAt.get(id),

    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
