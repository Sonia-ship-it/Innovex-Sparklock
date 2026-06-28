/**
 * Validates and stores sensor readings to TimescaleDB.
 * Implements validation logic and error handling.
 */

const { pool } = require('../db/timescale');

/**
 * Validation schema for sensor readings
 */
const VALIDATION_RULES = {
  temperature: { min: -50, max: 100, type: 'number' },
  humidity: { min: 0, max: 100, type: 'integer' },
  current: { min: 0, max: Infinity, type: 'number' },
  relay: { values: ['ON', 'OFF'], type: 'enum' },
  buzzer: { values: ['ON', 'OFF'], type: 'enum' },
  led: { values: ['RED', 'GREEN', 'YELLOW', 'BLUE'], type: 'enum' },
  ts: { type: 'timestamp' }
};

/**
 * Validates a sensor reading against the schema
 * @param {Object} data - Sensor reading data
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validateSensorReading(data) {
  const errors = [];

  // Validate temperature
  if (typeof data.temperature !== 'number' || isNaN(data.temperature)) {
    errors.push({ field: 'temperature', value: data.temperature, reason: 'must be a number' });
  } else if (data.temperature < -50 || data.temperature > 100) {
    errors.push({ field: 'temperature', value: data.temperature, reason: 'must be between -50 and 100' });
  }

  // Validate humidity
  if (typeof data.humidity === 'number') {
    data.humidity = Math.round(data.humidity); // convert float to int
  }
  if (!Number.isInteger(data.humidity)) {
    errors.push({ field: 'humidity', value: data.humidity, reason: 'must be an integer' });
  } else if (data.humidity < 0 || data.humidity > 100) {
    errors.push({ field: 'humidity', value: data.humidity, reason: 'must be between 0 and 100' });
  }

  // Validate current
  if (typeof data.current !== 'number' || isNaN(data.current)) {
    errors.push({ field: 'current', value: data.current, reason: 'must be a number' });
  } else if (data.current < 0) {
    errors.push({ field: 'current', value: data.current, reason: 'must be non-negative' });
  }

  // Validate relay
  if (!['ON', 'OFF'].includes(data.relay)) {
    errors.push({ field: 'relay', value: data.relay, reason: 'must be ON or OFF' });
  }

  // Validate buzzer
  if (!['ON', 'OFF'].includes(data.buzzer)) {
    errors.push({ field: 'buzzer', value: data.buzzer, reason: 'must be ON or OFF' });
  }

  // Validate LED
  if (!['RED', 'GREEN', 'YELLOW', 'BLUE', 'OFF'].includes(data.led)) {
    errors.push({ field: 'led', value: data.led, reason: 'must be RED, GREEN, YELLOW, BLUE, or OFF' });
  }

  // Validate timestamp
  if (data.ts !== undefined) {
    if (typeof data.ts !== 'number' || data.ts <= 0) {
      errors.push({ field: 'ts', value: data.ts, reason: 'must be a valid Unix timestamp' });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Stores a validated sensor reading to the database
 * @param {Object} data - Validated sensor reading
 * @returns {Promise<Object>} - Stored record
 */
async function storeSensorReading(data) {
  const validation = validateSensorReading(data);

  if (!validation.valid) {
    const errorDetails = validation.errors.map(e =>
      `${e.field}=${e.value} (${e.reason})`
    ).join(', ');
    console.error('[Storage] Validation failed:', errorDetails);
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  const { temperature, humidity, current, relay, buzzer, led, ts } = data;
  const timestamp = ts ? new Date(ts * 1000) : new Date();

  try {
    const result = await pool.query(
      `INSERT INTO sensor_data_pcm (temperature, humidity, current, relay, buzzer, led, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, temperature, humidity, current, relay, buzzer, led, timestamp`,
      [temperature, humidity, current, relay, buzzer, led, timestamp]
    );

    return result.rows[0];
  } catch (error) {
    console.error('[Storage] Database error:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}

/**
 * Stores a kcm sensor reading to the database
 * @param {Object} data - Sensor reading data { flame: boolean, gas: boolean }
 * @returns {Promise<Object>} - Stored record
 */
async function storeSensorReadingKcm(data) {
  // Support both legacy "gas" boolean and new "gas_detected" / "gas_value" format
  let flame = data.flame;
  let gas_detected = data.gas_detected !== undefined ? data.gas_detected : data.gas;

  // Convert anything to 1 or 0 integers since DWH expects integer, not boolean
  flame = (flame === true || flame === 'true' || flame === 1 || String(flame) === '1') ? 1 : 0;
  gas_detected = (gas_detected === true || gas_detected === 'true' || gas_detected === 1 || String(gas_detected) === '1') ? 1 : 0;

  const gas_value = data.gas_value || null;
  const ts = data.ts;
  const timestamp = ts ? new Date(ts * 1000) : new Date();

  try {
    const result = await pool.query(
      `INSERT INTO sensor_data_kcm (flame, gas, gas_detected, gas_value, timestamp)
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, flame, gas_detected, gas_value, timestamp`,
      [flame, gas_detected, gas_detected, gas_value, timestamp]
    );

    return result.rows[0];
  } catch (error) {
    console.error('[Storage] KCM Database error:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}

module.exports = {
  validateSensorReading,
  storeSensorReading,
  storeSensorReadingKcm,
  VALIDATION_RULES
};
