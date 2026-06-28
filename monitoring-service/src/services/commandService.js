/**
 * Command Service
 * 
 * Determines appropriate device control commands based on hazard severity
 * and publishes commands to IoT devices via MQTT.
 */

const listener = require('../mqtt/listener');

let isBuzzerSilenced = false;
let isTripped = false;

function setBuzzerSilenced(silenced) {
    isBuzzerSilenced = silenced;
}

function resetTripState() {
    isTripped = false;
    isBuzzerSilenced = false;
}

/**
 * Determines device control command based on hazard severity
 * 
 * @param {Array} hazards - Array of hazard event objects from rule engine
 * @returns {Object} Command object with led and buzzer properties
 * 
 * Logic:
 * - CRITICAL hazards -> RED LED + buzzer ON + relay OFF
 * - WARNING hazards -> YELLOW LED + buzzer ON (unless silenced)
 * - No hazards -> GREEN LED + buzzer OFF
 * - Multiple hazards -> use highest severity
 */
function determineDeviceCommand(hazards, deviceId = null) {
    const isKcm = deviceId && deviceId.toLowerCase().includes('kcm');

    // Handle empty or null hazards array
    if (!hazards || hazards.length === 0) {
        if (isTripped && !isKcm) {
            let buzzerState = isBuzzerSilenced ? "OFF" : "ON";
            return { "led": "RED", "buzzer": buzzerState, "relay": "OFF" };
        }
        isBuzzerSilenced = false;
        return { "led": "GREEN", "buzzer": "OFF" };
    }

    // Filter hazards relevant to the device type
    const relevantHazards = hazards.filter(h => {
        const hSource = h.sensorId.toLowerCase().includes('kcm') ? 'KCM' : 'PCM';
        return isKcm ? hSource === 'KCM' : hSource === 'PCM';
    });

    if (relevantHazards.length === 0) {
        if (isTripped && !isKcm) {
            let buzzerState = isBuzzerSilenced ? "OFF" : "ON";
            return { "led": "RED", "buzzer": buzzerState, "relay": "OFF" };
        }
        return { "led": "GREEN", "buzzer": "OFF" };
    }

    // Check for CRITICAL hazards
    const hasCriticalHazard = relevantHazards.some(h => h.severity === 'CRITICAL');
    const hasWarningHazard = relevantHazards.some(h => h.severity === 'WARNING');

    // Latch trip state if a critical hazard happens on the PCM
    if (hasCriticalHazard && !isKcm) {
        if (!isTripped) {
            isBuzzerSilenced = false; // Reset buzzer silence on fresh trip
        }
        isTripped = true;
    }

    let buzzerState = isBuzzerSilenced ? "OFF" : "ON";

    if (isTripped || hasCriticalHazard) {
        return { "led": "RED", "buzzer": buzzerState, "relay": "OFF" };
    } else if (hasWarningHazard) {
        return { "led": "YELLOW", "buzzer": buzzerState };
    } else {
        return { "led": "GREEN", "buzzer": "OFF" };
    }
}

/**
 * Publishes device control command to MQTT broker
 * 
 * @param {Object} command - Command object with led, buzzer, relay properties
 * @param {string} deviceId - Optional device identifier
 * @returns {Promise<Object>} Result object
 */
async function publishCommand(command, deviceId = null) {
    const client = listener.getClient();
    if (!client || !client.connected) {
        const error = 'MQTT client disconnected - cannot send command';
        console.error(`[CommandService] ${error}`, command);
        return { success: false, message: error };
    }

    const isKcm = deviceId && deviceId.toLowerCase().includes('kcm');

    // --- PRIORITY 1: DIRECT RELAY CONTROL ---
    if (command.relay !== undefined) {
        const relayTopic = isKcm ? 'SPARKLOCK/relay/control' : 'sparklock/relay/control';
        client.publish(relayTopic, command.relay, { qos: 1 });
        console.log(`[CommandService] FAST RELAY ${command.relay} sent to ${relayTopic}`);
    }

    // --- PRIORITY 2: DIRECT BUZZER CONTROL ---
    if (command.buzzer !== undefined) {
        const buzzerTopic = isKcm ? 'SPARKLOCK/buzzer/control' : 'sparklock/buzzer/control';
        client.publish(buzzerTopic, command.buzzer, { qos: 1 });
        console.log(`[CommandService] FAST BUZZER ${command.buzzer} sent to ${buzzerTopic}`);
    }

    // --- PRIORITY 3: FULL JSON COMMAND (Background) ---
    const commandMessage = {
        led: command.led,
        buzzer: command.buzzer,
        relay: command.relay,
        timestamp: new Date().toISOString(),
        ...(deviceId && { deviceId })
    };

    const mainTopic = isKcm ? 'SPARKLOCK/command' : 'sparklock/command';
    client.publish(mainTopic, JSON.stringify(commandMessage), { qos: 1 });

    return { success: true, message: 'Command published' };
}

module.exports = {
    determineDeviceCommand,
    publishCommand,
    setBuzzerSilenced,
    resetTripState
};
