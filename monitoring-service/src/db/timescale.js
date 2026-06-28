const { Pool } = require('pg');
const config = require('../config');

// Reconnection tracking
let reconnectAttempts = 0;
const MAX_RECONNECT_INTERVAL = 30000; // 30 seconds
const BASE_RECONNECT_INTERVAL = 1000; // 1 second

const pool = new Pool({
  host: config.timescale.host,
  port: config.timescale.port,
  database: config.timescale.database,
  user: config.timescale.user,
  password: config.timescale.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Calculate exponential backoff delay for reconnection attempts
 * @returns {number} Delay in milliseconds
 */
function getReconnectDelay() {
  const delay = Math.min(
    BASE_RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_INTERVAL
  );
  return delay;
}

/**
 * Handle pool errors and implement reconnection strategy
 */
pool.on('error', (err, client) => {
  console.error('[DB] Unexpected pool error:', {
    message: err.message,
    code: err.code
  });

  // Attempt reconnection with exponential backoff
  const delay = getReconnectDelay();
  console.log(`[DB] Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts + 1})`);

  setTimeout(async () => {
    try {
      await pool.query('SELECT 1');
      console.log('[DB] Reconnection successful');
      reconnectAttempts = 0;
    } catch (error) {
      reconnectAttempts++;
      console.error('[DB] Reconnection failed:', error.message);
    }
  }, delay);
});

/**
 * Handle successful pool connections
 */
pool.on('connect', () => {
  reconnectAttempts = 0;
  console.log('[DB] Pool connection established');
});

/**
 * Initialize the TimescaleDB schema.
 * Creates the sensor_data_pcm hypertable if it doesn't exist.
 * This function is idempotent and can be run multiple times safely.
 */
/**
 * Initialize the TimescaleDB schema.
 * Creates the sensor_data_pcm hypertable if it doesn't exist.
 * This function is idempotent and can be run multiple times safely.
 */
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create the extension if available
    await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`).catch(() => {
      console.log('[DB] TimescaleDB extension not available — using plain PostgreSQL');
    });

    // Create sensor_data_pcm table with proper constraints
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_data_pcm (
        id BIGSERIAL,
        temperature NUMERIC(4,1) NOT NULL,
        humidity INTEGER NOT NULL,
        current NUMERIC(10,2) NOT NULL,
        relay VARCHAR(3) NOT NULL,
        buzzer VARCHAR(3) NOT NULL,
        led VARCHAR(6) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, timestamp)
      );
    `);

    // Try to create hypertable (TimescaleDB-specific)
    await client.query(`
      SELECT create_hypertable('sensor_data_pcm', 'timestamp', if_not_exists => TRUE);
    `).catch(() => {
      console.log('[DB] Hypertable creation skipped (TimescaleDB may not be available)');
    });

    // Add CHECK constraints (idempotent)
    await client.query(`
      DO $$
      BEGIN
        -- Temperature constraint: -50 to 100
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'sensor_data_pcm_temperature_check'
        ) THEN
          ALTER TABLE sensor_data_pcm
          ADD CONSTRAINT sensor_data_pcm_temperature_check
          CHECK (temperature >= -50 AND temperature <= 100);
        END IF;

        -- Humidity constraint: 0 to 100
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'sensor_data_pcm_humidity_check'
        ) THEN
          ALTER TABLE sensor_data_pcm
          ADD CONSTRAINT sensor_data_pcm_humidity_check
          CHECK (humidity >= 0 AND humidity <= 100);
        END IF;

        -- Current constraint: non-negative
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'sensor_data_pcm_current_check'
        ) THEN
          ALTER TABLE sensor_data_pcm
          ADD CONSTRAINT sensor_data_pcm_current_check
          CHECK (current >= 0);
        END IF;

        -- Relay constraint: ON or OFF
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'sensor_data_pcm_relay_check'
        ) THEN
          ALTER TABLE sensor_data_pcm
          ADD CONSTRAINT sensor_data_pcm_relay_check
          CHECK (relay IN ('ON', 'OFF'));
        END IF;

        -- Buzzer constraint: ON or OFF
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'sensor_data_pcm_buzzer_check'
        ) THEN
          ALTER TABLE sensor_data_pcm
          ADD CONSTRAINT sensor_data_pcm_buzzer_check
          CHECK (buzzer IN ('ON', 'OFF'));
        END IF;

        -- LED constraint: RED, GREEN, YELLOW, or BLUE
        ALTER TABLE sensor_data_pcm DROP CONSTRAINT IF EXISTS sensor_data_pcm_led_check;
        ALTER TABLE sensor_data_pcm
        ADD CONSTRAINT sensor_data_pcm_led_check
        CHECK (led IN ('RED', 'GREEN', 'YELLOW', 'BLUE', 'OFF'));
      END $$;
    `);

    // Create index for efficient time-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_data_pcm_timestamp
      ON sensor_data_pcm (timestamp DESC);
    `);

    // Create sensor_data_kcm table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_data_kcm (
        id BIGSERIAL,
        flame INTEGER,
        gas INTEGER,
        gas_detected BOOLEAN,
        gas_value NUMERIC(10,2),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, timestamp)
      );
    `);

    // Upgrade existing kcm table to support new payload formats safely
    await client.query(`
      ALTER TABLE sensor_data_kcm ALTER COLUMN gas DROP NOT NULL;
      ALTER TABLE sensor_data_kcm ALTER COLUMN flame DROP NOT NULL;
      
      -- If they were BOOLEAN, convert to INTEGER
      DO $$ 
      BEGIN 
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'sensor_data_kcm' AND column_name = 'flame') = 'boolean' THEN
          ALTER TABLE sensor_data_kcm ALTER COLUMN flame TYPE INTEGER USING (CASE WHEN flame THEN 1 ELSE 0 END);
        END IF;
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'sensor_data_kcm' AND column_name = 'gas') = 'boolean' THEN
          ALTER TABLE sensor_data_kcm ALTER COLUMN gas TYPE INTEGER USING (CASE WHEN gas THEN 1 ELSE 0 END);
        END IF;
      END $$;

      ALTER TABLE sensor_data_kcm ADD COLUMN IF NOT EXISTS gas_detected BOOLEAN;
      ALTER TABLE sensor_data_kcm ADD COLUMN IF NOT EXISTS gas_value NUMERIC(10,2);
    `).catch((err) => {
      console.log('[DB] Failed to alter KCM table schema:', err.message);
    });

    // Try to create hypertable for kcm
    await client.query(`
      SELECT create_hypertable('sensor_data_kcm', 'timestamp', if_not_exists => TRUE);
    `).catch(() => {
      console.log('[DB] Hypertable creation skipped for kcm (TimescaleDB may not be available)');
    });

    // Create index for efficient time-based queries for kcm
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_data_kcm_timestamp
      ON sensor_data_kcm (timestamp DESC);
    `);

    // Create camera_alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS camera_alerts (
        id BIGSERIAL,
        image_url TEXT NOT NULL,
        gas_value NUMERIC(10,2),
        flame INTEGER,
        location TEXT,
        fire_confirmed BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, timestamp)
      );
    `);

    // Try to create hypertable for camera_alerts
    await client.query(`
      SELECT create_hypertable('camera_alerts', 'timestamp', if_not_exists => TRUE);
    `).catch(() => {
      console.log('[DB] Hypertable creation skipped for camera_alerts (TimescaleDB may not be available)');
    });

    // Create index for efficient time-based queries for camera_alerts
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_camera_alerts_timestamp
      ON camera_alerts (timestamp DESC);
    `);

    console.log('[DB] TimescaleDB schema initialized successfully');
  } finally {
    client.release();
  }
}


/**
 * Insert a sensor reading into the database.
 */
async function insertSensorData(data) {
  const { temperature, humidity, current, relay, buzzer, led, ts } = data;
  const timestamp = ts ? new Date(ts * 1000) : new Date();
  const result = await pool.query(
    `INSERT INTO sensor_data_pcm (temperature, humidity, current, relay, buzzer, led, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [temperature, humidity, current, relay, buzzer, led, timestamp]
  );
  return result.rows[0];
}

/**
 * Get the latest readings for all sensors.
 */
async function getLatestReadings() {
  const result = await pool.query(`
    SELECT temperature, humidity, current, relay, buzzer, led, timestamp
    FROM sensor_data_pcm
    ORDER BY timestamp DESC
    LIMIT 20
  `);
  return result.rows;
}

/**
 * Get readings for a specific sensor type within a time range.
 */
async function getReadingsByType(sensorType, hoursBack = 1) {
  const result = await pool.query(
    `SELECT id, temperature, humidity, current, relay, buzzer, led, timestamp
     FROM sensor_data_pcm
     WHERE sensor_type = $1 AND timestamp > NOW() - INTERVAL '${hoursBack} hours'
     ORDER BY timestamp DESC
     LIMIT 1000`,
    [sensorType]
  );
  return result.rows;
}

module.exports = {
  pool,
  initializeDatabase,
  insertSensorData,
  getLatestReadings,
  getReadingsByType,
};
