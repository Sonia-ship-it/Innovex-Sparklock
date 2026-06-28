const { Server } = require('socket.io');

let io = null;

/**
 * Initializes the WebSocket server using socket.io.
 * @param {import('http').Server} httpServer - The HTTP server to attach to.
 */
function initializeWebSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    console.log('[WebSocket] Server initialized');

    io.on('connection', (socket) => {
        console.log(`[WebSocket] Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        });

        // Optional: Join a specific device room
        socket.on('subscribe', (deviceId) => {
            socket.join(deviceId);
            console.log(`[WebSocket] Client ${socket.id} subscribed to device: ${deviceId}`);
        });
    });

    return io;
}

/**
 * Broadcasts sensor data to all connected clients.
 * @param {string} event - The event name (e.g., 'pcm_data', 'alert')
 * @param {Object} data - The data payload
 * @param {string} [deviceId] - Optional device room to emit to
 */
function broadcast(event, data, deviceId = null) {
    if (!io) return;

    if (deviceId) {
        io.to(deviceId).emit(event, data);
    } else {
        io.emit(event, data);
    }
}

module.exports = {
    initializeWebSocket,
    broadcast,
    getIo: () => io,
};
