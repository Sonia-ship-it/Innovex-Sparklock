const fs = require('fs');
const path = require('path');
const { publishHazardEvent } = require('./kafkaProducer');
const { uploadToUploadThing } = require('./uploadService');
const { pool } = require('../db/timescale');

// Ensure image directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads/camera_alerts');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Process alert from camera system.
 * Saves the image locally AND uploads to UploadThing for frontend access.
 */
async function processCameraAlert(data) {
    const { image, readings, fire_confirmed, timestamp } = data;
    const filename = `alert_${Date.now()}.jpg`;
    const filePath = path.join(UPLOAD_DIR, filename);

    try {
        // 1. Convert Base64 to Buffer
        const buffer = Buffer.from(image, 'base64');

        // 2. Save locally as backup
        fs.writeFileSync(filePath, buffer);
        console.log(`[CameraService] Image saved locally to ${filePath}`);

        // 3. Upload to UploadThing for public access
        let imageUrl = `/uploads/camera_alerts/${filename}`; // Default to local
        try {
            const remoteUrl = await uploadToUploadThing(buffer, filename);
            if (remoteUrl) {
                imageUrl = remoteUrl;
                console.log(`[CameraService] Image uploaded to UploadThing: ${imageUrl}`);
            }
        } catch (uploadError) {
            console.error(`[CameraService] UploadThing failed, using local fallback:`, uploadError.message);
        }

        // 4. Save to Database
        try {
            const dbResult = await pool.query(
                `INSERT INTO camera_alerts (image_url, gas_value, flame, location, fire_confirmed, timestamp)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [
                    imageUrl,
                    readings.gas_value || null,
                    readings.flame || 0,
                    readings.location || 'Camera System',
                    fire_confirmed || false,
                    timestamp ? new Date(timestamp) : new Date()
                ]
            );
            console.log(`[CameraService] Alert stored in database: id=${dbResult.rows[0].id}`);
        } catch (dbError) {
            console.error(`[CameraService] Database insertion failed:`, dbError.message);
        }

        // 5. Determine hazard details
        const severity = fire_confirmed ? 'CRITICAL' : 'WARNING';
        const type = fire_confirmed ? 'fire_confirmed' : 'abnormal_sensor_reading';

        const hazardEvent = {
            type,
            sensorId: readings.sensorId || 'camera_pi',
            sensorType: 'camera_alert',
            value: readings.gas_value || readings.gas || readings.flame,
            unit: readings.flame ? 'boolean' : 'ppm',
            location: readings.location || 'Raspberry Pi Location',
            severity,
            image_url: imageUrl,
            message: fire_confirmed ? "FIRE CONFIRMED BY CAMERA SYSTEM!" : "Abnormal reading triggered camera capture. Review image.",
            detectedAt: timestamp || new Date().toISOString(),
        };

        // 6. Publish to Kafka for other services (notification, etc.)
        await publishHazardEvent(hazardEvent);
        console.log(`[CameraService] Hazard event published: ${hazardEvent.message}`);

        return { success: true, filename, hazardEvent, remoteUrl: imageUrl };
    } catch (error) {
        console.error(`[CameraService] Error processing camera alert:`, error.message);
        throw error;
    }
}

module.exports = {
    processCameraAlert,
};
