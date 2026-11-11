const { insertSensorData } = require('../db/timescale');
const { evaluateSensorData } = require('./ruleEngine');
// Command services are dynamically loaded inside to avoid circular dependencies

/**
 * Process incoming sensor data:
 * 1. Persist to TimescaleDB
 * 2. Evaluate against hazard rules
 * 3. Return the persisted record + any hazard event
 *
 * @param {Object} data - Sensor reading from API or MQTT
 * @returns {Object} - { record, hazard }
 */
async function processSensorReading(data) {
    const { temperature, humidity, current, relay, buzzer, led, ts } = data;

    if (temperature === undefined || humidity === undefined || current === undefined || !relay || !buzzer || !led) {
        throw new Error('Missing required fields: temperature, humidity, current, relay, buzzer, led');
    }

    // 1. Persist to database and 2. Evaluate rules IN PARALLEL
    const deviceId = data.sensorId || 'esp8266_main';
    const location = data.location || 'main_room';

    // 1. Evaluate rules FIRST for maximum speed in emergency
    const [tempHazard, humHazard, currentHazard] = await Promise.all([
        evaluateSensorData({
            sensorId: `${deviceId}_temp`,
            sensorType: 'temperature',
            value: parseFloat(temperature),
            location,
        }),
        evaluateSensorData({
            sensorId: `${deviceId}_humidity`,
            sensorType: 'humidity',
            value: parseFloat(humidity),
            location,
        }),
        evaluateSensorData({
            sensorId: `${deviceId}_current`,
            sensorType: 'current',
            value: parseFloat(current),
            location,
        })
    ]);

    const hazards = [tempHazard, humHazard, currentHazard].filter(Boolean);

    // 2. IMMEDIATE device control: publish command according to current hazards
    let effectiveRelay = relay;
    let effectiveBuzzer = buzzer;
    let effectiveLed = led;

    try {
        const { determineDeviceCommand, publishCommand } = require('./commandService');
        const command = determineDeviceCommand(hazards, deviceId, { relay, buzzer, led });

        if (command.relay) effectiveRelay = command.relay;
        if (command.buzzer) effectiveBuzzer = command.buzzer;
        if (command.led) effectiveLed = command.led;

        // Critical safety relay command sent BEFORE DB persistence to avoid any latency
        const result = await publishCommand(command, deviceId);

        if (result.success) {
            if (command.relay === 'OFF') {
                console.log(`[SensorService] EMERGENCY KILL POWER: Relay OFF sent!`);
            }
            console.log(`[SensorService] Auto-control: ${command.led} LED, buzzer ${command.buzzer}`);
        } else {
            console.error(`[SensorService] Auto-control failed: ${result.message}`);
        }
    } catch (error) {
        console.error(`[SensorService] Device control error:`, error.message);
    }

    // 3. Persist to database with the effective alarm/hardware state so system & physical alarm stay in sync
    const record = await insertSensorData({
        temperature,
        humidity,
        current,
        relay: effectiveRelay,
        buzzer: effectiveBuzzer,
        led: effectiveLed,
        ts
    });

    return { record, hazards };
}

module.exports = {
    processSensorReading,
};
