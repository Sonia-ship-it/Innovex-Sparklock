import { Platform } from 'react-native';

const MACHINE_IP = '10.12.75.148'; // Latest machine IP
const API_BASE_URL = `http://${MACHINE_IP}:8085`;
const MONITOR_API_BASE_URL = `http://${MACHINE_IP}:3001`;
const HISTORY_API_BASE_URL = `http://${MACHINE_IP}:8086`;
const NOTIFY_API_BASE_URL = `http://${MACHINE_IP}:3002`;

/**
 * Robust fetch with timeout to prevent hanging requests in mobile environments.
 */
async function fetchWithTimeout(url: string, options: any = {}) {
    const { timeout = 5000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Connection': 'keep-alive',
                'Keep-Alive': 'timeout=5, max=1000',
                'Cache-Control': 'no-cache',
                ...(options.headers || {})
            },
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection.');
        }
        throw error;
    }
}

export const authApi = {
    signup: async (data: { email: string; password: string; firstName: string; lastName: string }) => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Registration failed');
        }

        return response.json();
    },

    login: async (data: { email: string; password: string }) => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Login failed');
        }

        return response.json();
    },

    resetPassword: async (data: { email: string }) => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Password reset failed');
        }

        return response.json();
    },

    verifyOtp: async (data: { email: string; code: string; newPassword: string }) => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'OTP verification failed');
        }

        return response.json();
    },

    updateProfile: async (data: { fullName: string; email: string; emergencyContact: string; location: string; profileImage: string | null; token: string }) => {
        const { token, ...bodyData } = data;
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bodyData),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Profile update failed on server');
        }

        return response.json();
    }
};

export const monitorApi = {
    getPcmLive: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/pcm/live`, { timeout: 3000 });
        if (!response.ok) throw new Error('Failed to fetch PCM data');
        return response.json();
    },
    getPcmHistory: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/pcm/live/all`);
        if (!response.ok) throw new Error('Failed to fetch PCM history');
        return response.json();
    },
    getKcmLive: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/kcm/live`, { timeout: 3000 });
        if (!response.ok) throw new Error('Failed to fetch KCM data');
        return response.json();
    },
    getKcmHistory: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/kcm/live/all`);
        if (!response.ok) throw new Error('Failed to fetch KCM history');
        return response.json();
    },
    restorePower: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/power/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ safe: true }),
        });
        if (!response.ok) throw new Error('Failed to restore power');
        return response.json();
    },
    killPower: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/power/kill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ immediate: true }),
        });
        if (!response.ok) throw new Error('Failed to kill power');
        return response.json();
    },
    sendCommand: async (command: { led?: string; buzzer?: string; relay?: string }) => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(command),
        });
        if (!response.ok) throw new Error('Failed to send command');
        return response.json();
    },
    getCameraAlerts: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/alerts/camera`, { timeout: 3000 });
        if (!response.ok) throw new Error('Failed to fetch camera alerts');
        return response.json();
    },
    getThresholds: async () => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/thresholds`);
        if (!response.ok) throw new Error('Failed to fetch thresholds');
        return response.json();
    },
    updateThreshold: async (type: string, level: string, value: number) => {
        const response = await fetchWithTimeout(`${MONITOR_API_BASE_URL}/monitor/thresholds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, level, value }),
        });
        if (!response.ok) throw new Error('Failed to update threshold');
        return response.json();
    }
};

export const historyApi = {
    getEvents: async (page = 0, size = 50) => {
        // Primary: use monitoring service which has real PCM/KCM sensor history
        try {
            const response = await fetchWithTimeout(
                `${MONITOR_API_BASE_URL}/monitor/history?limit=${size}`,
                { timeout: 8000 }
            );
            if (response.ok) {
                const json = await response.json();
                if (json.success && Array.isArray(json.data)) {
                    return json;
                }
            }
        } catch (e) {
            console.warn('[History] Monitor fallback attempt...');
        }

        // Fallback: try history-service (requires DB tables to exist)
        const response = await fetchWithTimeout(
            `${HISTORY_API_BASE_URL}/history/events?page=${page}&size=${size}`,
            { timeout: 5000 }
        );
        if (!response.ok) throw new Error('Failed to fetch history events');
        return response.json();
    },
    getEventDetail: async (id: number) => {
        const response = await fetchWithTimeout(`${HISTORY_API_BASE_URL}/history/events/${id}`);
        if (!response.ok) throw new Error('Failed to fetch event detail');
        return response.json();
    },
    getStats: async () => {
        const response = await fetchWithTimeout(`${HISTORY_API_BASE_URL}/history/stats`);
        if (!response.ok) throw new Error('Failed to fetch history stats');
        return response.json();
    }
};

export const notifyApi = {
    sendNotification: async (data: { userId: string; title: string; body: string; type: string; metadata?: any }) => {
        const response = await fetchWithTimeout(`${NOTIFY_API_BASE_URL}/notify/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to send notification');
        return response.json();
    }
};

export { MONITOR_API_BASE_URL };

