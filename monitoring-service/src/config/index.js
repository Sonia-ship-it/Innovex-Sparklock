require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,

  timescale: {
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT, 10) || 5432,
    database: process.env.TIMESCALE_DB || 'sparklock_monitoring',
    user: process.env.TIMESCALE_USER || 'sparklock',
    password: process.env.TIMESCALE_PASSWORD || 'sparklock_secret',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    topicHazard: process.env.KAFKA_TOPIC_HAZARD || 'hazard-events',
  },

  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://test.mosquitto.org:1883',
    topic: process.env.MQTT_TOPIC || 'sparklock/#',
  },

  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8085',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3002',
  uploadthingToken: process.env.UPLOADTHING_API,
};
