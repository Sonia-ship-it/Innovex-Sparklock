const { publishHazardEvent } = require('./kafkaProducer');
const { triggerNotification } = require('./notificationService');

// ─── Configurable thresholds ───
const THRESHOLDS = {
    temperature: {
        warning: 55,    // °C
        critical: 65,   // °C
        unit: '°C',
    },
    smoke: {
        warning: 700,   // adjusted for normal gas levels ~594
        critical: 2000,
        unit: 'ppm',
    },
    current: {
        warning: 0.5,   // A
        critical: 0.9,  // A (power cut threshold)
        unit: 'A',
    },
    gas: {
        warning: 700,   // increased because 600 is normal in cold areas
        critical: 2000,  // ppm
        unit: 'ppm',
    },
    humidity: {
        warning: 30,    // % (low = fire risk)
        critical: 20,   // %
        unit: '%',
        invertLogic: true,
    },
};

/**
 * Evaluate sensor data against hazard thresholds.
 * Returns a hazard event if thresholds are exceeded, or null.
 *
 * @param {Object} sensorData - { sensorId, sensorType, value, unit, location }
 * @returns {Object|null} - hazard event or null
 */
async function evaluateSensorData(sensorData) {
    const { sensorId, sensorType, value, location } = sensorData;
    const threshold = THRESHOLDS[sensorType];

    if (!threshold) {
        // Unknown sensor type — no rules defined
        return null;
    }

    let severity = null;
    const invertLogic = threshold.invertLogic || false;
    const evalValue = sensorType === 'current' ? Math.abs(value) : value;

    if (invertLogic) {
        // For inverted metrics (humidity), lower is worse
        if (evalValue <= threshold.critical) {
            severity = 'CRITICAL';
        } else if (evalValue <= threshold.warning) {
            severity = 'WARNING';
        }
    } else {
        // Normal metrics — higher is worse
        // 1. Check Critical First
        if (evalValue >= threshold.critical) {
            severity = 'CRITICAL';
        }
        // 2. Check Warning Only if not Critical
        else if (evalValue >= threshold.warning) {
            severity = 'WARNING';
        }
    }

    if (severity) {
        const source = sensorId.toLowerCase().includes('kcm') ? 'KCM' : 'PCM';
        const hazardEvent = {
            type: `${sensorType}_hazard`,
            sensorId,
            sensorType,
            value,
            unit: threshold.unit,
            location: location || 'unknown',
            severity,
            threshold: severity === 'CRITICAL' ? threshold.critical : threshold.warning,
            message: `[${source}] ${sensorType.replace('_', ' ')} ${invertLogic ? 'below' : 'above'} ${severity.toLowerCase()} threshold: ${value}${threshold.unit} (limit: ${severity === 'CRITICAL' ? threshold.critical : threshold.warning}${threshold.unit})`,
            detectedAt: new Date().toISOString(),
        };

        console.log(`[RuleEngine] HAZARD DETECTED: ${hazardEvent.message}`);

        // Publish to Kafka in background - do not await here
        publishHazardEvent(hazardEvent).catch(err => {
            console.error(`[RuleEngine] Background Kafka publish failed:`, err.message);
        });

        // Trigger Notification in background
        triggerNotification(hazardEvent).catch(err => {
            console.error(`[RuleEngine] Background Notification failed:`, err.message);
        });

        return hazardEvent;
    }

    return null;
}

/**
 * Update a specific threshold value.
 * @param {string} type - sensor type (gas, temperature, etc.)
 * @param {string} level - severity level (warning, critical)
 * @param {number} value - new threshold value
 */
function updateThreshold(type, level, value) {
    if (THRESHOLDS[type] && THRESHOLDS[type][level] !== undefined) {
        THRESHOLDS[type][level] = value;
        console.log(`[RuleEngine] Updated ${type} ${level} threshold to ${value}`);
        return true;
    }
    return false;
}

/**
 * Get all current thresholds.
 */
function getThresholds() {
    return THRESHOLDS;
}

module.exports = {
    evaluateSensorData,
    updateThreshold,
    getThresholds,
    THRESHOLDS,
};
