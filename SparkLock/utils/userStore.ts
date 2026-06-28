import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface UserData {
    fullName: string;
    email: string;
    location: string;
    emergencyContact: string;
    profileImage: string | null;
    token?: string | null;
}

const DEFAULT_USER: UserData = {
    fullName: "Building Owner",
    email: "owner@sparklock.com",
    location: "Kigali, Rwanda",
    emergencyContact: "999",
    profileImage: null,
    token: null,
};

let currentUser: UserData = { ...DEFAULT_USER };
const listeners = new Set<() => void>();

export const userStore = {
    getUser: () => currentUser,
    setUser: (data: Partial<UserData>) => {
        currentUser = { ...currentUser, ...data };
        AsyncStorage.setItem('sparklock_user', JSON.stringify(currentUser)).catch(console.error);
        listeners.forEach(listener => listener());
    },
    resetUser: () => {
        currentUser = { ...DEFAULT_USER };
        AsyncStorage.removeItem('sparklock_user').catch(console.error);
        listeners.forEach(listener => listener());
    },
    loadStoredUser: async () => {
        try {
            const data = await AsyncStorage.getItem('sparklock_user');
            if (data) {
                currentUser = { ...currentUser, ...JSON.parse(data) };
                listeners.forEach(listener => listener());
            }
        } catch (error) {
            console.error('Failed to load user', error);
        }
        return currentUser;
    },
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
};

export function useUser() {
    return useSyncExternalStore(userStore.subscribe, userStore.getUser);
}
