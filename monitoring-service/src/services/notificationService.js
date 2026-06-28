const axios = require('axios');
const config = require('../config');

/**
 * Sends a notification via the Notification Service
 * @param {Object} hazardEvent - The hazard event details
 */
async function triggerNotification(hazardEvent) {
    try {
        const payload = {
            userId: 'all', // In a multi-user system, this would be the building owner ID
            title: `HAZARD: ${hazardEvent.severity}`,
            body: hazardEvent.message,
            type: hazardEvent.type,
            metadata: {
                severity: hazardEvent.severity,
                sensorId: hazardEvent.sensorId,
                detectedAt: hazardEvent.detectedAt
            }
        };

        const response = await axios.post(`${config.notificationServiceUrl}/notify/send`, payload);

        if (response.data && response.data.success) {
            console.log(`[NotificationService] Notification triggered for ${hazardEvent.type}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[NotificationService] Failed to trigger notification:', error.message);
        return false;
    }
}

module.exports = {
    triggerNotification
};
