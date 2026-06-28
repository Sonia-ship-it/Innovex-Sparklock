const mqtt = require('mqtt');
const config = require('../config');
const sensorService = require('../services/sensorService');
const cameraService = require('../services/cameraService');
const { storeSensorReading, storeSensorReadingKcm } = require('../services/storageService');
const { broadcast } = require('../services/websocketService');

let client = null;

/**
 * Start the MQTT listener.
 * Subscribes to sensor topics and processes incoming data through the pipeline.
 */
function startMqttListener() {
    try {
        client = mqtt.connect(config.mqtt.broker, {
            reconnectPeriod: 5000,
            connectTimeout: 10000,
        });

        client.on('connect', () => {
            console.log(`[MQTT] Connected to broker: ${config.mqtt.broker}`);
            client.subscribe(config.mqtt.topic, (err) => {
                if (err) {
                    console.error('[MQTT] Subscribe error:', err.message);
                } else {
                    console.log(`[MQTT] Subscribed to topic: ${config.mqtt.topic}`);
                }
            });
            client.subscribe('SPARKLOCK/#', (err) => {
                if (err) {
                    console.error('[MQTT] Subscribe error (SPARKLOCK/#):', err.message);
                } else {
                    console.log(`[MQTT] Subscribed to topic: SPARKLOCK/#`);
                }
            });
        });

        client.on('message', async (topic, message) => {
            const rawMessage = message.toString();
            let data;

            try {
                data = JSON.parse(rawMessage);
            } catch (parseError) {
                // Some topics might receive plain text strings like "offline" or "online"
                // If it's not JSON, we can just skip it or log it
                if (rawMessage === 'offline' || rawMessage === 'online') {
                    console.log(`[MQTT] Received status update from topic ${topic}: ${rawMessage}`);
                    return;
                }

                console.error(`[MQTT] Invalid JSON payload from topic ${topic}: ${rawMessage}`);
                return; // Stop processing this message
            }

            try {
                console.log(`[MQTT] Received data from topic ${topic}:`, data);

                // Handle different topic formats
                if (topic === 'sparklock/sensor') {
                    // Trigger asynchronous processing - do not 'await' here to prevent blocking the listener loop
                    (async () => {
                        try {
                            const result = await sensorService.processSensorReading(data);
                            // Broadcast real-time data to clients
                            broadcast('pcm_data', { ...data, timestamp: new Date() });

                            if (result.hazards && result.hazards.length > 0) {
                                console.log(`[MQTT] Hazards detected:`, result.hazards.map(h => h.type).join(', '));
                                broadcast('hazard_detected', { hazards: result.hazards, readings: data });
                            }
                        } catch (err) {
                            console.error(`[MQTT] Error processing PCM sensor data:`, err.message);
                        }
                    })();
                } else if (topic === 'sparklock/device/health' || topic === 'sparklock/device/status') {
                    console.log(`[MQTT] Device health/status update:`, data);
                } else if (topic === 'SPARKLOCK/sensor') {
                    try {
                        // Ensure gas_value is present even if hardware sends it as 'gas'
                        if (data.gas !== undefined && data.gas_value === undefined) {
                            data.gas_value = data.gas;
                        }

                        const record = await storeSensorReadingKcm(data);
                        console.log(`[MQTT] Stored KCM sensor reading: id=${record.id}, gas_value=${data.gas_value}`);

                        // Broadcast updated data with gas_value ensured
                        broadcast('kcm_data', { ...data, timestamp: new Date() });

                        // evaluate gas hazard
                        let hazards = [];
                        if (data.gas_value !== undefined) {
                            const { evaluateSensorData } = require('../services/ruleEngine');
                            const hazard = await evaluateSensorData({
                                sensorId: data.sensorId || 'kcm_sensor_main',
                                sensorType: 'gas',
                                value: parseFloat(data.gas_value),
                                location: data.location || 'main_room'
                            });
                            if (hazard) hazards.push(hazard);
                        }

                        if (data.flame === 1 || data.flame === true || data.flame === '1') {
                            hazards.push({
                                type: 'flame_hazard',
                                sensorId: data.sensorId || 'kcm_sensor_main',
                                sensorType: 'flame',
                                value: 1,
                                severity: 'CRITICAL',
                                message: 'FLAME DETECTED'
                            });
                        }

                        if (hazards.length > 0) {
                            console.log(`[MQTT] KCM Hazard(s) detected:`, hazards.map(h => h.type).join(', '));
                            broadcast('hazard_detected', { hazards, readings: data });

                            // trigger command 
                            try {
                                const { determineDeviceCommand, publishCommand } = require('../services/commandService');
                                const command = determineDeviceCommand(hazards, 'kcm');
                                await publishCommand(command, 'kcm');
                            } catch (cmdErr) {
                                console.error(`[MQTT] Device control error for KCM:`, cmdErr.message);
                            }
                        }
                    } catch (err) {
                        console.error(`[MQTT] Error storing KCM sensor data:`, err.message);
                    }
                } else if (topic === 'sparklock/camera/alert') {
                    (async () => {
                        console.log(`[MQTT] Received camera alert! Processing...`);
                        try {
                            const result = await cameraService.processCameraAlert(data);
                            console.log(`[MQTT] Camera alert processed: ${result.filename}`);
                            broadcast('camera_alert', result.hazardEvent);
                        } catch (err) {
                            console.error(`[MQTT] Error processing camera alert:`, err.message);
                        }
                    })();
                } else if (topic === 'sparklock/command') {
                    return;
                } else {
                    const topicParts = topic.split('/');
                    const parsedSensorType = topicParts[2] || 'unknown';
                    const parsedSensorId = topicParts[3] || 'unknown';

                    const sensorData = {
                        sensorId: data.sensorId || parsedSensorId,
                        sensorType: data.sensorType || parsedSensorType,
                        value: data.value,
                        unit: data.unit,
                        location: data.location,
                        metadata: { source: 'mqtt', topic },
                    };

                    sensorService.processSensorReading(sensorData).catch(err => {
                        console.error(`[MQTT] Error processing generic sensor data:`, err.message);
                    });
                }
            } catch (error) {
                console.error('[MQTT] Error processing message:', error.message);
            }
        });

        client.on('error', (error) => {
            console.error('[MQTT] Connection error:', error.message);
        });

        client.on('reconnect', () => {
            console.log('[MQTT] Attempting reconnection...');
        });

        client.on('close', () => {
            console.log('[MQTT] Connection closed');
        });
    } catch (error) {
        console.error('[MQTT] Failed to initialize listener:', error.message);
        console.log('[MQTT] Monitoring service will continue without MQTT');
    }
}

function stopMqttListener() {
    if (client) {
        client.end();
        console.log('[MQTT] Listener stopped');
    }
}

module.exports = {
    startMqttListener,
    stopMqttListener,
    getClient: () => client, // Export client instance via getter for command publishing
};
