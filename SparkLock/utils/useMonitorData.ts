import { useEffect, useCallback, useRef } from 'react';
import { monitorApi, MONITOR_API_BASE_URL } from './api';
import { io, Socket } from 'socket.io-client';
import { monitorStore, useMonitorStore } from './monitorStore';

// Global socket instance for singleton connection
let socket: Socket | null = null;

const getSocket = () => {
    if (!socket) {
        const socketUrl = MONITOR_API_BASE_URL.replace('/monitor', '');
        socket = io(socketUrl, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
            timeout: 10000,
        });

        socket.on('connect', () => console.log('[Socket] Global Connected'));

        socket.on('pcm_data', (data) => {
            monitorStore.setPcmData(data);
        });

        socket.on('kcm_data', (data) => {
            monitorStore.setKcmData(data);
        });

        socket.on('camera_alert', (newAlert) => {
            monitorStore.addAlert(newAlert);
        });
    }
    return socket;
};

/**
 * Global background manager. Should be mounted ONCE in _layout.tsx
 */
export function useMonitorManager() {
    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const historyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refreshData = useCallback(async () => {
        try {
            const [pcm, kcm, alerts, thresholds] = await Promise.all([
                monitorApi.getPcmLive().catch(() => null),
                monitorApi.getKcmLive().catch(() => null),
                monitorApi.getCameraAlerts().catch(() => null),
                monitorApi.getThresholds().catch(() => null)
            ]);

            if (pcm?.success) monitorStore.setPcmData(pcm.data);
            if (kcm?.success) monitorStore.setKcmData(kcm.data);
            if (alerts?.success) monitorStore.setAlerts(alerts.data);
            if (thresholds?.success) monitorStore.setThresholds(thresholds.data);
        } catch (e) { }
    }, []);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await monitorApi.getPcmHistory().catch(() => null);
            if (res?.success && Array.isArray(res.data)) {
                monitorStore.setHistory(res.data.slice(0, 12).reverse());
            }
        } catch (e) { }
    }, []);

    useEffect(() => {
        getSocket();
        refreshData();
        fetchHistory();

        const pollInterval = setInterval(refreshData, 3000);
        const historyInterval = setInterval(fetchHistory, 30000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(historyInterval);
        };
    }, []);
}

/**
 * Consumer hooks - INSTANT response because they use global state
 */
export function useMonitorData() {
    const { pcmData, kcmData } = useMonitorStore();
    return { pcmData, kcmData, loading: !pcmData && !kcmData, error: null };
}

export function useHistoricalData() {
    const { history } = useMonitorStore();
    return history;
}

export function useCameraAlerts() {
    const { alerts } = useMonitorStore();
    return alerts;
}
