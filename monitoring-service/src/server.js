const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const monitorRoutes = require('./routes/monitor');
const { initializeDatabase } = require('./db/timescale');
const { connectProducer } = require('./services/kafkaProducer');
const { startMqttListener } = require('./mqtt/listener');
const { initializeWebSocket } = require('./services/websocketService');

const app = express();
const server = http.createServer(app);

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));

// ─── Routes ───
app.use('/monitor', monitorRoutes);

// ─── Root health check ───
app.get('/', (req, res) => {
    res.json({ service: 'sparklock-monitoring', status: 'running', ws: 'socket.io enabled' });
});

// ─── Start Server ───
async function startServer() {
    try {
        // Initialize database schema
        console.log('[Server] Initializing TimescaleDB...');
        try {
            await initializeDatabase();
        } catch (dbErr) {
            console.error('[Server] DB Init failed:', dbErr.message);
        }

        // Initialize WebSockets
        console.log('[Server] Initializing WebSockets...');
        initializeWebSocket(server);

        // Connect Kafka producer (non-blocking)
        console.log('[Server] Connecting Kafka producer...');
        connectProducer();

        // Start MQTT listener for IoT sensors
        console.log('[Server] Starting MQTT listener...');
        try {
            startMqttListener();
        } catch (mqttErr) {
            console.error('[Server] MQTT Listener failed:', mqttErr.message);
        }

        // Start HTTP server
        server.listen(config.port, () => {
            console.log(`[Server] Monitoring service running on port ${config.port}`);
            console.log(`[Server] API: http://localhost:${config.port}/monitor`);
            console.log(`[Server] WS: ws://localhost:${config.port}`);
        });
    } catch (error) {
        console.error('[Server] Fatal error on start:', error.message);
        // Start HTTP server even if some integrations fail
        server.listen(config.port, () => {
            console.log(`[Server] Monitoring service running on port ${config.port} (degraded mode)`);
        });
    }
}

startServer();

module.exports = app;
