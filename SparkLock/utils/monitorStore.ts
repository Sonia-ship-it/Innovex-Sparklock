import { useSyncExternalStore } from 'react';

export interface MonitorState {
    pcmData: any;
    kcmData: any;
    alerts: any[];
    history: any[];
    isSilenced: boolean;
    thresholds: any;
}

const DEFAULT_STATE: MonitorState = {
    pcmData: null,
    kcmData: null,
    alerts: [],
    history: [],
    isSilenced: false,
    thresholds: {
        gas: { warning: 700, critical: 2000 },
        current: { warning: 0.5, critical: 1.0 },
        temperature: { warning: 55, critical: 65 }
    }
};

let currentState: MonitorState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();

export const monitorStore = {
    getState: () => currentState,

    setPcmData: (data: any) => {
        currentState = { ...currentState, pcmData: data };
        listeners.forEach(l => l());
    },

    setKcmData: (data: any) => {
        currentState = { ...currentState, kcmData: data };
        listeners.forEach(l => l());
    },

    setAlerts: (alerts: any[]) => {
        currentState = { ...currentState, alerts };
        listeners.forEach(l => l());
    },

    addAlert: (alert: any) => {
        const newAlerts = [alert, ...currentState.alerts].slice(0, 10);
        currentState = { ...currentState, alerts: newAlerts };
        listeners.forEach(l => l());
    },

    setHistory: (history: any[]) => {
        currentState = { ...currentState, history };
        listeners.forEach(l => l());
    },

    setIsSilenced: (isSilenced: boolean) => {
        currentState = { ...currentState, isSilenced };
        listeners.forEach(l => l());
    },

    setThresholds: (thresholds: any) => {
        currentState = { ...currentState, thresholds };
        listeners.forEach(l => l());
    },

    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
};

export function useMonitorStore() {
    return useSyncExternalStore(monitorStore.subscribe, monitorStore.getState);
}
