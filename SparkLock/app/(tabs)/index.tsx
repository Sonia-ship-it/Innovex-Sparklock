import { useFocusEffect, useRouter } from "expo-router";
import { AlertCircle, Flame, Thermometer, User, Zap, X } from "lucide-react-native";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View, Alert } from "react-native";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../utils/themeContext";
import { monitorStore, useMonitorStore } from "../../utils/monitorStore";
import { useMonitorData } from "../../utils/useMonitorData";
import { monitorApi } from "../../utils/api";
import { useUser } from "../../utils/userStore";
import { styles } from "../index";

export default function HomeDashboard() {
    const route = useRouter();
    const insets = useSafeAreaInsets();
    const user = useUser();
    const { isDarkMode } = useTheme();
    const soundRef = useRef<Audio.Sound | null>(null);
    const wasHazardous = useRef(false);
    const wasCritical = useRef(false);

    const { pcmData, kcmData } = useMonitorData();
    const store = useMonitorStore();
    const globalIsSilenced = store.isSilenced;

    // Memoize safety calculations for speed
    const { isHazardous, isCritical, isWarning, isOnline, currentMag, isPcmFresh, isKcmFresh, isFireSafe, isElectricalSafe } = useMemo(() => {
        const pcmFresh = pcmData && (pcmData.ageSeconds === undefined || pcmData.ageSeconds < 300);
        const kcmFresh = kcmData && (kcmData.ageSeconds === undefined || kcmData.ageSeconds < 300);
        const online = pcmFresh || kcmFresh;
        const mag = pcmData?.current !== undefined ? Math.abs(pcmData.current) : 0;
        const thresholds = store.thresholds;

        const gasWarningVal = thresholds?.gas?.warning || 700;
        const gasCriticalVal = thresholds?.gas?.critical || 2000;
        const tempWarningVal = thresholds?.temperature?.warning || 55;
        const tempCriticalVal = thresholds?.temperature?.critical || 65;
        const currentWarningVal = thresholds?.current?.warning || 0.5;
        const currentCriticalVal = thresholds?.current?.critical || 1.0;

        const critical = (pcmFresh && (mag >= currentCriticalVal || pcmData.temperature >= tempCriticalVal || pcmData.led === 'RED')) ||
            (kcmFresh && (kcmData.flame === 1 || kcmData.gas_value >= gasCriticalVal));

        const warning = !critical && (
            (pcmFresh && (mag >= currentWarningVal && mag < currentCriticalVal || pcmData.temperature >= tempWarningVal && pcmData.temperature < tempCriticalVal || pcmData.led === 'YELLOW')) ||
            (kcmFresh && (kcmData.gas_value >= gasWarningVal && kcmData.gas_value < gasCriticalVal))
        );

        const fireSafe = !(kcmFresh && (kcmData.flame === 1 || kcmData.gas_value >= gasWarningVal));
        const electricalSafe = !(pcmFresh && (mag >= currentWarningVal || pcmData.temperature >= tempWarningVal));

        return {
            isCritical: critical,
            isWarning: warning,
            isHazardous: critical || warning,
            isOnline: online,
            currentMag: mag,
            isPcmFresh: pcmFresh,
            isKcmFresh: kcmFresh,
            isFireSafe: fireSafe,
            isElectricalSafe: electricalSafe
        };
    }, [pcmData, kcmData, store.thresholds]);

    useEffect(() => {
        let isCleaningUp = false;

        const manageSound = async () => {
            // Notification sound should play if there's a hazard AND they haven't silenced it yet
            const shouldPlay = isHazardous && !globalIsSilenced;

            if (shouldPlay) {
                if (!soundRef.current) {
                    try {
                        const { sound: newSound } = await Audio.Sound.createAsync(
                            require('../../assets/sound/255181__adamweeden__bs-fire-alarm-sweeping-1-hz.wav'),
                            { isLooping: true }
                        );
                        if (isCleaningUp) {
                            await newSound.unloadAsync();
                            return;
                        }
                        soundRef.current = newSound;
                        await newSound.playAsync();
                    } catch (e) {
                        console.error("[Audio] Failed to load/play sound:", e);
                    }
                }
            } else {
                if (soundRef.current) {
                    try {
                        const s = soundRef.current;
                        soundRef.current = null;
                        await s.stopAsync();
                        await s.unloadAsync();
                    } catch (e) {
                        console.warn("[Audio] Error stopping sound:", e);
                    }
                }
            }
        };

        manageSound();

        return () => {
            isCleaningUp = true;
            if (soundRef.current) {
                const s = soundRef.current;
                soundRef.current = null;
                s.unloadAsync().catch(() => { });
            }
        };
    }, [isHazardous, globalIsSilenced]);
    useEffect(() => {
        // Reset silenced state if we transition from NO hazard to a hazard,
        // OR if we escalate from warning to critical!
        const escalated = isCritical && !wasCritical.current;
        const newHazard = isHazardous && !wasHazardous.current;

        if (newHazard || escalated) {
            monitorStore.setIsSilenced(false);
        }
        wasHazardous.current = isHazardous;
        wasCritical.current = isCritical;
    }, [isHazardous, isCritical]);


    const handleSilence = () => {
        // 1. Instant local silence
        monitorStore.setIsSilenced(true);
        if (soundRef.current) {
            const s = soundRef.current;
            soundRef.current = null;
            s.stopAsync().catch(() => { });
            s.unloadAsync().catch(() => { });
        }

        // Optimistically update the buzzer state in the UI
        const currentPcmData = monitorStore.getState().pcmData;
        if (currentPcmData) {
            monitorStore.setPcmData({ ...currentPcmData, buzzer: 'OFF' });
        }

        // 2. Immediate background command (non-blocking)
        monitorApi.sendCommand({ buzzer: 'OFF' }).catch(err => {
            console.warn("Background silence command failed:", err.message);
        });

        if (!isFireSafe) {
            route.push({
                pathname: "/fire-detected",
                params: { gasValue: String(kcmData?.gas_value || 0), location: kcmData?.location || "Main Room" }
            });
        }
    };

    const handlePowerAction = (action: 'restore' | 'kill') => {
        // Optimistic Feedback
        monitorStore.setIsSilenced(true); // Silence alarm immediately on any manual intervention

        const currentPcmData = monitorStore.getState().pcmData;

        if (action === 'restore') {
            if (currentPcmData) {
                monitorStore.setPcmData({ ...currentPcmData, relay: 'ON', buzzer: 'OFF' });
            }
            monitorApi.restorePower().catch(err => {
                console.error('[Dashboard] Power restoration failed:', err.message);
            });
            Alert.alert("Success", "Power restoration protocol initiated.");
        } else {
            if (currentPcmData) {
                monitorStore.setPcmData({ ...currentPcmData, relay: 'OFF', current: 0, buzzer: 'OFF' });
            }
            monitorApi.killPower().catch(err => {
                console.error('[Dashboard] Power kill failed:', err.message);
            });
            Alert.alert("Danger Averted", "Power killed immediately.");
        }
    };

    const handleRestorePower = () => handlePowerAction('restore');
    const handleKillPower = () => handlePowerAction('kill');
    const handleResetLine = handleRestorePower;

    return (
        <View className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} relative`} style={{ paddingTop: insets.top }}>
            {/* Full-Screen Modal Notification - WARNING */}
            {isWarning && !globalIsSilenced && (
                <View className="absolute z-50 top-0 bottom-0 left-0 right-0 bg-black/60 items-center justify-center px-6" pointerEvents="auto">
                    <View className="bg-orange-500 p-8 rounded-[32px] shadow-2xl border-4 border-orange-700 w-full max-w-[400px]" style={{ elevation: 20 }}>
                        <Text className="text-white font-black text-2xl mb-2 text-center">⚠️ SYSTEM WARNING</Text>
                        <Text className="text-white/90 text-[15px] mb-8 text-center leading-5 font-medium">Abnormal conditions detected. Please check the system.</Text>

                        <TouchableOpacity onPress={handleSilence} className="bg-black/90 py-4 rounded-2xl items-center shadow-lg w-full">
                            <Text className="text-white text-[16px] font-black uppercase tracking-widest">Silence Alarm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Full-Screen Modal Notification - CRITICAL */}
            {isCritical && !globalIsSilenced && (
                <View className="absolute z-50 top-0 bottom-0 left-0 right-0 bg-black/70 items-center justify-center px-6" pointerEvents="auto">
                    <View className="bg-red-600 p-8 rounded-[32px] shadow-2xl border-4 border-red-800 w-full max-w-[400px]" style={{ elevation: 20 }}>
                        <Text className="text-white font-black text-2xl mb-2 text-center">⚠️ CRITICAL ALERT</Text>
                        <Text className="text-white/90 text-[15px] mb-8 text-center leading-5 font-medium">Danger detected! Immediate action is required to secure the premises.</Text>

                        <View className="w-full gap-3">
                            <TouchableOpacity onPress={handleSilence} className="w-full bg-black/90 py-4 rounded-2xl items-center shadow-lg">
                                <Text className="text-white text-[15px] font-black uppercase tracking-widest">Silence Alarm</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleRestorePower} className="w-full bg-[#D66A1F] py-4 rounded-2xl items-center shadow-lg border border-[#ed8945]">
                                <Text className="text-white text-[15px] font-black uppercase tracking-widest">Restore Power</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Top Header */}
            <View className={`px-6 flex-row justify-between items-center pb-2 ${isDarkMode ? "bg-black" : "bg-white"}`}>
                <View>
                    <Text className="text-[#D66A1F] text-2xl" style={styles.title}>SPARKLOCK</Text>
                    <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-sm`} style={styles.text}>{user.location}</Text>
                </View>
                <TouchableOpacity onPress={() => route.push("/(tabs)/profile")} className={`w-10 h-10 rounded-full border border-[#D66A1F] ${isDarkMode ? "bg-[#333]" : "bg-[#FAEBE4]"} items-center justify-center overflow-hidden`}>
                    {user.profileImage ? (
                        <Image source={{ uri: user.profileImage }} className="w-full h-full" />
                    ) : (
                        <User size={20} color="#D66A1F" />
                    )}
                </TouchableOpacity>
            </View>
            <View className={`h-[1px] w-full ${isDarkMode ? "bg-[#333]" : "bg-gray-200"} mb-6`} />

            <ScrollView className="px-6 flex-1 mb-24" showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center justify-between mb-1">
                    <Text className={`text-3xl ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>Home Dashboard</Text>
                    <View className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full ${isOnline ? (isDarkMode ? 'bg-green-900/30' : 'bg-green-100') : (isDarkMode ? 'bg-red-900/30' : 'bg-red-100')}`}>
                        <View className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                        <Text className={`text-[10px] font-bold tracking-wider ${isOnline ? (isDarkMode ? 'text-green-400' : 'text-green-700') : (isDarkMode ? 'text-red-400' : 'text-red-700')}`}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
                    </View>
                </View>
                <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-sm mb-6`} style={styles.text}>Real-time building safety status</Text>

                {/* Status Cards */}
                <View className="flex-row gap-4 mb-8">
                    <View className={`flex-1 ${isElectricalSafe ? 'bg-[#D66A1F]' : 'bg-red-500'} rounded-[24px] p-5 min-h-[140px] justify-between shadow-md`} style={{ elevation: 4 }}>
                        <View className="flex-row justify-between items-start">
                            <View className={`w-12 h-12 ${isElectricalSafe ? "bg-white/20" : "bg-white"} rounded-2xl items-center justify-center`}>
                                <Zap size={24} color={isElectricalSafe ? "#FFF" : "#EF4444"} />
                            </View>
                            <View className={`px-2.5 py-1 rounded-full ${isElectricalSafe ? 'bg-white/20' : 'bg-black/30'}`}>
                                <Text className="text-white text-[10px] font-black tracking-wider" style={styles.subtitle}>{isElectricalSafe ? 'SAFE' : 'DANGER'}</Text>
                            </View>
                        </View>
                        <Text className="text-white text-[15px] font-bold mt-4" style={styles.subtitle}>Electrical Status</Text>
                    </View>

                    <TouchableOpacity onPress={() => route.push("/fire-detected")} className={`flex-1 ${isFireSafe ? 'bg-[#D66A1F]' : 'bg-red-500'} rounded-[24px] p-5 min-h-[140px] justify-between shadow-md`} style={{ elevation: 4 }}>
                        <View className="flex-row justify-between items-start">
                            <View className={`w-12 h-12 ${isFireSafe ? "bg-white/20" : "bg-white"} rounded-2xl items-center justify-center`}>
                                <Flame size={24} color={isFireSafe ? "#FFF" : "#EF4444"} />
                            </View>
                            <View className={`px-2.5 py-1 rounded-full ${isFireSafe ? 'bg-white/20' : 'bg-black/30'}`}>
                                <Text className="text-white text-[10px] font-black tracking-wider" style={styles.subtitle}>{isFireSafe ? 'SAFE' : 'DANGER'}</Text>
                            </View>
                        </View>
                        <Text className="text-white text-[15px] font-bold mt-4" style={styles.subtitle}>Fire Status</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick Indicators */}
                <Text className={`text-[13px] mb-4 uppercase tracking-widest font-bold ${isDarkMode ? "text-gray-500" : "text-[#888]"}`} style={styles.subtitle}>Live Readings</Text>

                <View className={`${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-white border-gray-100"} rounded-[20px] shadow-sm border p-5 mb-3 flex-row justify-between items-center`} style={{ elevation: 2 }}>
                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 rounded-full bg-[#FAEBE4] items-center justify-center">
                            <Zap size={20} color="#D66A1F" />
                        </View>
                        <Text className={`${isDarkMode ? "text-gray-300" : "text-[#444]"} text-base font-medium`} style={styles.subtitle}>Total Load</Text>
                    </View>
                    <Text className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-black"}`} style={styles.subtitle}>{pcmData?.current?.toFixed(2) ?? '0.00'} <Text className="text-[13px] text-gray-400 font-medium">A</Text></Text>
                </View>

                <View className={`${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-white border-gray-100"} rounded-[20px] shadow-sm border p-5 mb-3 flex-row justify-between items-center`} style={{ elevation: 2 }}>
                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 rounded-full bg-[#FAEBE4] items-center justify-center">
                            <Thermometer size={20} color="#D66A1F" />
                        </View>
                        <Text className={`${isDarkMode ? "text-gray-300" : "text-[#444]"} text-base font-medium`} style={styles.subtitle}>Indoor Temp</Text>
                    </View>
                    <Text className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-black"}`} style={styles.subtitle}>{pcmData?.temperature?.toFixed(2) ?? '0.00'} <Text className="text-[13px] text-gray-400 font-medium">°C</Text></Text>
                </View>

                <View className={`${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-white border-gray-100"} rounded-[20px] shadow-sm border p-5 mb-3 flex-row justify-between items-center`} style={{ elevation: 2 }}>
                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 rounded-full bg-[#FAEBE4] items-center justify-center">
                            <AlertCircle size={20} color="#D66A1F" />
                        </View>
                        <Text className={`${isDarkMode ? "text-gray-300" : "text-[#444]"} text-base font-medium`} style={styles.subtitle}>Smoke Level</Text>
                    </View>
                    <Text className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-black"}`} style={styles.subtitle}>{kcmData?.gas_value !== undefined ? Number(kcmData.gas_value).toFixed(2) : '0.00'} <Text className="text-[13px] text-gray-400 font-medium">PPM</Text></Text>
                </View>

                <View className={`${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-white border-gray-100"} rounded-[20px] shadow-sm border p-5 mb-8 flex-row justify-between items-center`} style={{ elevation: 2 }}>
                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 rounded-full bg-[#FAEBE4] items-center justify-center">
                            <Flame size={20} color="#D66A1F" />
                        </View>
                        <Text className={`${isDarkMode ? "text-gray-300" : "text-[#444]"} text-base font-medium`} style={styles.subtitle}>Fire Detection</Text>
                    </View>
                    <Text className={`text-[13px] font-black tracking-wider px-3 py-1.5 rounded-full ${kcmData?.flame === 1 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`} style={styles.subtitle}>{kcmData ? (kcmData.flame === 1 ? 'FIRE' : 'NO FIRE') : 'NO FIRE'}</Text>
                </View>

                {/* Quick Controls */}
                <View className="bg-[#D66A1F] rounded-[24px] p-6 mb-8 pt-6 shadow-md" style={{ elevation: 5 }}>
                    <Text className="text-center text-white/90 text-[13px] uppercase tracking-widest font-bold mb-4" style={styles.subtitle}>Emergency Protocol</Text>

                    <View className="gap-3">
                        <TouchableOpacity onPress={handleKillPower} className="w-full bg-white p-4 rounded-[16px] items-center justify-center shadow-lg active:bg-gray-100">
                            <Text className="text-[#D66A1F] text-lg font-black tracking-wider" style={styles.subtitle}>KILL ALL POWER</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleResetLine} className="w-full bg-black p-4 rounded-[16px] items-center justify-center shadow-lg active:bg-gray-900 border border-gray-800">
                            <Text className="text-white text-lg font-black tracking-wider" style={styles.subtitle}>RESET LINE</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}
