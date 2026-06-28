const express = require('express');
const router = express.Router();
const { processSensorReading } = require('../services/sensorService');
const { getLatestReadings, getReadingsByType, pool } = require('../db/timescale');
const { THRESHOLDS } = require('../services/ruleEngine');
const { authMiddleware } = require('../middleware/auth');
const { publishCommand, setBuzzerSilenced, resetTripState } = require('../services/commandService');

/**
 * POST /monitor/data
 * Receive sensor data from IoT devices.
 *
 * Body: { sensorId, sensorType, value, unit?, location?, metadata? }
 */
router.post('/data/pcm', async (req, res) => {
    try {
        const result = await processSensorReading(req.body);

        res.status(201).json({
            success: true,
            data: {
                record: result.record,
                hazards: result.hazards || [],
            },
        });
    } catch (error) {
        console.error('[API] POST /monitor/data error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /monitorpcm/live
 * Retrieve the most recent sensor reading with freshness information.
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 12345,
 *     "temperature": 21.8,
 *     "humidity": 72,
 *     "current": 0.00,
 *     "relay": "ON",
 *     "buzzer": "OFF",
 *     "led": "GREEN",
 *     "timestamp": "2025-01-29T10:15:30.000Z",
 *     "ageSeconds": 5
 *   }
 * }
 */

/*
Per-circuit safety module
*/

router.get('/pcm/live', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, temperature, humidity, current, relay, buzzer, led, timestamp,
                   EXTRACT(EPOCH FROM (NOW() - timestamp)) AS age_seconds
            FROM sensor_data_pcm
            ORDER BY timestamp DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No sensor data available'
            });
        }

        const reading = result.rows[0];

        res.json({
            success: true,
            data: {
                id: reading.id,
                temperature: parseFloat(reading.temperature),
                humidity: reading.humidity,
                current: parseFloat(reading.current),
                relay: reading.relay,
                buzzer: reading.buzzer,
                led: reading.led,
                timestamp: reading.timestamp,
                ageSeconds: Math.floor(reading.age_seconds)
            }
        });
    } catch (error) {
        console.error('[API] GET /monitorpcm/live error:', {
            message: error.message,
            code: error.code
        });

        // Check if it's a connection error
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                error: 'Database connection unavailable'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve sensor data'
        });
    }
});

router.get('/pcm/live/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, temperature, humidity, current, relay, buzzer, led, timestamp,
                   EXTRACT(EPOCH FROM (NOW() - timestamp)) AS age_seconds
            FROM sensor_data_pcm
            ORDER BY timestamp DESC
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No sensor data available'
            });
        }

        const data = result.rows.map(reading => ({
            id: reading.id,
            temperature: parseFloat(reading.temperature),
            humidity: reading.humidity,
            current: parseFloat(reading.current),
            relay: reading.relay,
            buzzer: reading.buzzer,
            led: reading.led,
            timestamp: reading.timestamp,
            ageSeconds: Math.floor(reading.age_seconds)
        }));

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('[API] GET /monitorpcm/live error:', {
            message: error.message,
            code: error.code
        });

        // Check if it's a connection error
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                error: 'Database connection unavailable'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve sensor data'
        });
    }
});


router.get('/kcm/live', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, flame, gas, gas_detected, gas_value, timestamp,
                   EXTRACT(EPOCH FROM (NOW() - timestamp)) AS age_seconds
            FROM sensor_data_kcm
            ORDER BY timestamp DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No KCM sensor data available'
            });
        }

        const reading = result.rows[0];

        res.json({
            success: true,
            data: {
                id: reading.id,
                flame: reading.flame,
                gas: reading.gas,
                gas_detected: reading.gas_detected,
                gas_value: reading.gas_value !== null ? parseFloat(reading.gas_value) : null,
                timestamp: reading.timestamp,
                ageSeconds: Math.floor(reading.age_seconds)
            }
        });
    } catch (error) {
        console.error('[API] GET /monitor/kcm/live error:', {
            message: error.message,
            code: error.code
        });

        // Check if it's a connection error
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                error: 'Database connection unavailable'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve KCM sensor data'
        });
    }
});

router.get('/kcm/live/all', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, flame, gas, gas_detected, gas_value, timestamp,
                   EXTRACT(EPOCH FROM (NOW() - timestamp)) AS age_seconds
            FROM sensor_data_kcm
            ORDER BY timestamp DESC
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No KCM sensor data available'
            });
        }

        const data = result.rows.map(reading => ({
            id: reading.id,
            flame: reading.flame,
            gas: reading.gas,
            gas_detected: reading.gas_detected,
            gas_value: reading.gas_value !== null ? parseFloat(reading.gas_value) : null,
            timestamp: reading.timestamp,
            ageSeconds: Math.floor(reading.age_seconds)
        }));

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('[API] GET /monitor/kcm/live/all error:', {
            message: error.message,
            code: error.code
        });

        // Check if it's a connection error
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                error: 'Database connection unavailable'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve KCM sensor data'
        });
    }
});
/**
 * GET /monitor/status
 * Health check endpoint.
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        service: 'monitoring-service',
        status: 'operational',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /monitor/command
 * Send control commands to IoT devices
 * 
 * Body: { led?: string, buzzer?: string, deviceId?: string }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Command published successfully",
 *   "command": { "led": "RED", "buzzer": "ON", "timestamp": "..." }
 * }
 */
router.post('/command', async (req, res) => {
    try {
        const { led, buzzer, relay, deviceId } = req.body;

        // Validation
        const validLedColors = ['RED', 'GREEN', 'YELLOW', 'BLUE', 'OFF'];
        const validBuzzerStates = ['ON', 'OFF'];
        const validRelayStates = ['ON', 'OFF'];

        // Validate LED if provided
        if (led && !validLedColors.includes(led)) {
            console.error('[API] Invalid LED color:', led);
            return res.status(400).json({
                success: false,
                error: `Invalid LED color. Must be one of: ${validLedColors.join(', ')}`
            });
        }

        // Validate buzzer if provided
        if (buzzer && !validBuzzerStates.includes(buzzer)) {
            console.error('[API] Invalid buzzer state:', buzzer);
            return res.status(400).json({
                success: false,
                error: `Invalid buzzer state. Must be one of: ${validBuzzerStates.join(', ')}`
            });
        }

        // Validate relay if provided
        if (relay && !validRelayStates.includes(relay)) {
            console.error('[API] Invalid relay state:', relay);
            return res.status(400).json({
                success: false,
                error: `Invalid relay state. Must be one of: ${validRelayStates.join(', ')}`
            });
        }

        // At least one field must be provided
        if (!led && !buzzer && !relay) {
            console.error('[API] Missing command fields');
            return res.status(400).json({
                success: false,
                error: 'At least one of led, buzzer, or relay must be provided'
            });
        }

        // Build command object
        const command = {};
        if (led) command.led = led;
        if (buzzer) {
            command.buzzer = buzzer;
            if (buzzer === 'OFF') {
                if (setBuzzerSilenced) setBuzzerSilenced(true);
            }
        }
        if (relay) command.relay = relay;

        // Publish command
        const result = await publishCommand(command, deviceId);

        if (!result.success) {
            // MQTT unavailable
            return res.status(503).json({
                success: false,
                error: result.message
            });
        }

        // Success
        console.log('[API] Command published successfully:', command);
        res.json({
            success: true,
            message: result.message,
            command: {
                ...command,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] POST /monitor/command error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to process command'
        });
    }
});

/**
 * POST /monitor/power/restore
 * Safely restores power to a circuit by setting relay to ON
 * 
 * Body: { safe: boolean, deviceId?: string }
 */
router.post('/power/restore', async (req, res) => {
    try {
        const { safe, deviceId } = req.body;

        if (safe !== true) {
            return res.status(400).json({
                success: false,
                error: 'Must explicitly provide { "safe": true } to restore power'
            });
        }

        // Restoring power means turning the relay back ON (making the circuit active)
        const command = { relay: 'ON' };
        if (resetTripState) resetTripState();
        if (setBuzzerSilenced) setBuzzerSilenced(false);

        // Publish command to MQTT
        const result = await publishCommand(command, deviceId);

        if (!result.success) {
            return res.status(503).json({
                success: false,
                error: result.message
            });
        }

        console.log('[API] Power restored explicitly via API:', command);

        res.json({
            success: true,
            message: 'Power restoration command sent successfully',
            command: {
                ...command,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] POST /monitor/power/restore error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to restore power'
        });
    }
});

/**
 * POST /monitor/power/kill
 * Safely kills power to a circuit by setting relay to OFF
 * 
 * Body: { immediate: boolean, deviceId?: string }
 */
router.post('/power/kill', async (req, res) => {
    try {
        const { immediate, deviceId } = req.body;

        if (immediate !== true) {
            return res.status(400).json({
                success: false,
                error: 'Must explicitly provide { "immediate": true } to kill power'
            });
        }

        const command = { relay: 'OFF' };

        // Publish command to MQTT
        const result = await publishCommand(command, deviceId);

        if (!result.success) {
            return res.status(503).json({
                success: false,
                error: result.message
            });
        }

        console.log('[API] Power killed explicitly via API:', command);

        res.json({
            success: true,
            message: 'Power kill command sent successfully',
            command: {
                ...command,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[API] POST /monitor/power/kill error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to kill power'
        });
    }
});

/**
 * GET /monitor/alerts/camera
 * Retrieve recent camera alerts.
 */
router.get('/alerts/camera', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, image_url, gas_value, flame, location, fire_confirmed, timestamp
            FROM camera_alerts
            ORDER BY timestamp DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('[API] GET /monitor/alerts/camera error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve camera alerts'
        });
    }
});

/**
 * GET /monitor/thresholds
 * Retrieve all current sensor thresholds.
 */
router.get('/thresholds', (req, res) => {
    const { getThresholds } = require('../services/ruleEngine');
    res.json({
        success: true,
        data: getThresholds()
    });
});

/**
 * POST /monitor/thresholds
 * Update a specific sensor threshold.
 * 
 * Body: { type: string, level: string, value: number }
 */
router.post('/thresholds', (req, res) => {
    const { updateThreshold } = require('../services/ruleEngine');
    const { type, level, value } = req.body;

    if (!type || !level || value === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Missing type, level, or value'
        });
    }

    const success = updateThreshold(type, level, value);

    if (success) {
        res.json({
            success: true,
            message: `Threshold ${type}:${level} updated to ${value}`
        });
    } else {
        res.status(400).json({
            success: false,
            error: 'Invalid sensor type or level'
        });
    }
});

/**
 * GET /monitor/history
 * Returns a merged timeline of meaningful sensor events from PCM and KCM data.
 * Used by the mobile app history tab when the history-service is unavailable.
 */
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const [pcmResult, kcmResult, cameraResult] = await Promise.all([
            pool.query(`
                SELECT id, temperature, current, relay, buzzer, led, timestamp
                FROM sensor_data_pcm
                ORDER BY timestamp DESC
                LIMIT $1
            `, [limit]).catch(() => ({ rows: [] })),

            pool.query(`
                SELECT id, flame, gas_detected, gas_value, timestamp
                FROM sensor_data_kcm
                ORDER BY timestamp DESC
                LIMIT $1
            `, [limit]).catch(() => ({ rows: [] })),

            pool.query(`
                SELECT id, image_url, gas_value, flame, location, fire_confirmed, timestamp
                FROM camera_alerts
                ORDER BY timestamp DESC
                LIMIT 20
            `).catch(() => ({ rows: [] }))
        ]);

        const events = [];

        // Process PCM readings — flag abnormal readings
        for (const r of pcmResult.rows) {
            const current = parseFloat(r.current) || 0;
            const temp = parseFloat(r.temperature) || 0;
            const isHighCurrent = current >= 0.5;
            const isHighTemp = temp >= 55;
            const isRedLed = r.led === 'RED';
            const isYellowLed = r.led === 'YELLOW';
            const isRelayOff = r.relay === 'OFF';

            if (isHighCurrent || isHighTemp || isRedLed || isYellowLed || isRelayOff) {
                let severity = 'INFO';
                let title = 'Electrical Reading';
                let message = '';

                if (isRedLed || current >= 0.9 || temp >= 65) {
                    severity = 'CRITICAL';
                    title = 'Critical Electrical Alert';
                } else if (isYellowLed || isHighCurrent || isHighTemp) {
                    severity = 'WARNING';
                    title = 'Electrical Warning';
                }

                if (isRelayOff) {
                    message = `Power cut. Current: ${current.toFixed(2)}A, Temp: ${temp.toFixed(1)}°C.`;
                } else if (isHighCurrent && isHighTemp) {
                    message = `High load (${current.toFixed(2)}A) and elevated temperature (${temp.toFixed(1)}°C) detected.`;
                } else if (isHighCurrent) {
                    message = `High current detected: ${current.toFixed(2)}A on main line.`;
                } else if (isHighTemp) {
                    message = `Elevated temperature: ${temp.toFixed(1)}°C on electrical circuit.`;
                } else {
                    message = `LED status ${r.led}. Current: ${current.toFixed(2)}A, Temp: ${temp.toFixed(1)}°C.`;
                }

                events.push({
                    id: `pcm-${r.id}`,
                    type: 'ELECTRICAL_EVENT',
                    severity,
                    title,
                    message,
                    location: 'Main Electrical Line',
                    timestamp: r.timestamp,
                    source: 'pcm'
                });
            }
        }

        // Process KCM readings — flag flame or gas detections
        for (const r of kcmResult.rows) {
            const gasValue = parseFloat(r.gas_value) || 0;
            const flameDetected = r.flame === 1 || r.flame === true;
            const gasDetected = r.gas_detected === true || gasValue >= 700;

            if (flameDetected || gasDetected) {
                let severity = gasValue >= 2000 || flameDetected ? 'CRITICAL' : 'WARNING';
                let title = flameDetected ? 'Fire Detection' : 'Gas Detection';
                let message = '';

                if (flameDetected && gasDetected) {
                    message = `Flame and gas detected simultaneously. Gas level: ${gasValue.toFixed(0)} PPM.`;
                } else if (flameDetected) {
                    message = `Flame detected in kitchen. Confirmed ${r.flame === 0 ? 'SAFE' : 'ACTIVE'} by sensor.`;
                } else {
                    message = `Gas concentration: ${gasValue.toFixed(0)} PPM detected. Threshold exceeded.`;
                }

                events.push({
                    id: `kcm-${r.id}`,
                    type: flameDetected ? 'FIRE_DETECTION' : 'GAS_DETECTION',
                    severity,
                    title,
                    message,
                    location: 'Kitchen',
                    timestamp: r.timestamp,
                    source: 'kcm'
                });
            }
        }

        // Add camera alerts
        for (const r of cameraResult.rows) {
            events.push({
                id: `cam-${r.id}`,
                type: 'CAMERA_ALERT',
                severity: r.fire_confirmed ? 'CRITICAL' : 'WARNING',
                title: r.fire_confirmed ? 'Fire Confirmed by Camera' : 'Camera Alert',
                message: `Visual detection at ${r.location || 'Camera'}. Gas: ${r.gas_value || 0} PPM, Flame: ${r.flame ? 'YES' : 'NO'}.`,
                location: r.location || 'Camera',
                timestamp: r.timestamp,
                source: 'camera'
            });
        }

        // Sort all events by timestamp descending
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            data: events.slice(0, limit),
            totalElements: events.length
        });
    } catch (error) {
        console.error('[API] GET /monitor/history error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to build history'
        });
    }
});

module.exports = router;
