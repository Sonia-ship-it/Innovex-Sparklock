const { Kafka } = require('kafkajs');
const config = require('../config');

const kafka = new Kafka({
    clientId: 'monitoring-service',
    brokers: config.kafka.brokers,
    retry: {
        initialRetryTime: 1000,
        retries: 5,
    },
});

const producer = kafka.producer();
let isConnected = false;

async function connectProducer() {
    try {
        await producer.connect();
        isConnected = true;
        console.log('[Kafka] Producer connected successfully');
    } catch (error) {
        console.error('[Kafka] Failed to connect producer:', error.message);
        console.log('[Kafka] Will retry on next publish attempt');
    }
}

/**
 * Publish a hazard event to the Kafka topic.
 * @param {Object} event - The hazard event payload
 */
async function publishHazardEvent(event) {
    try {
        if (!isConnected) {
            await connectProducer();
        }

        await producer.send({
            topic: config.kafka.topicHazard,
            messages: [
                {
                    key: event.sensorId,
                    value: JSON.stringify({
                        ...event,
                        publishedAt: new Date().toISOString(),
                    }),
                },
            ],
        });

        console.log(`[Kafka] Hazard event published: ${event.type} from sensor ${event.sensorId}`);
        return true;
    } catch (error) {
        console.error('[Kafka] Failed to publish hazard event:', error.message);
        isConnected = false;
        return false;
    }
}

async function disconnectProducer() {
    if (isConnected) {
        await producer.disconnect();
        isConnected = false;
        console.log('[Kafka] Producer disconnected');
    }
}

module.exports = {
    connectProducer,
    publishHazardEvent,
    disconnectProducer,
};
