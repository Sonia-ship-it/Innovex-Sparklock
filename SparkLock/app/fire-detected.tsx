import { useRouter, useLocalSearchParams } from "expo-router";
import { Check, Flame, X, Phone, AlertTriangle } from "lucide-react-native";
import { Text, TouchableOpacity, View, Image, Linking, Alert } from "react-native";
import { useTheme } from "../utils/themeContext";
import { styles } from "./index";
import { monitorApi, MONITOR_API_BASE_URL } from "../utils/api";
import { useUser } from "../utils/userStore";
import { monitorStore } from "../utils/monitorStore";

export default function FireDetected() {
    const route = useRouter();
    const params = useLocalSearchParams();
    const { isDarkMode } = useTheme();
    const user = useUser();

    // Parse params
    const imageUrlRaw = params.imageUrl as string;
    const location = params.location as string || "Building Wide";
    const gasValue = params.gasValue as string;

    const imageUrl = imageUrlRaw?.startsWith('http')
        ? imageUrlRaw
        : `${MONITOR_API_BASE_URL}${imageUrlRaw}`;

    const handleDangerous = async () => {
        try {
            // Keep notification sound OFF but physical buzzer ON
            monitorStore.setIsSilenced(true);

            // Optimistic UI Update
            const currentPcmData = monitorStore.getState().pcmData;
            if (currentPcmData) {
                monitorStore.setPcmData({ ...currentPcmData, buzzer: 'ON', led: 'RED' });
            }

            // 1. Activate Buzzer
            await monitorApi.sendCommand({ buzzer: 'ON', led: 'RED' });

            // 2. Alert User
            Alert.alert(
                "Emergency Activated",
                "Alarms are now active. Calling emergency services...",
                [
                    {
                        text: "Call Now",
                        onPress: () => Linking.openURL(`tel:${user.emergencyContact || '999'}`)
                    }
                ]
            );
        } catch (err) {
            console.error("Failed to activate emergency measures:", err);
            // Fallback to calling even if command fails
            Linking.openURL(`tel:${user.emergencyContact || '999'}`);
        }
    };

    const handleSafe = async () => {
        try {
            // 1. Immediately reset app silence store
            monitorStore.setIsSilenced(false);

            // Optimistic UI Update
            const currentPcmData = monitorStore.getState().pcmData;
            if (currentPcmData) {
                monitorStore.setPcmData({ ...currentPcmData, buzzer: 'OFF', led: 'GREEN' });
            }
            const currentKcmData = monitorStore.getState().kcmData;
            if (currentKcmData) {
                monitorStore.setKcmData({ ...currentKcmData, flame: 0 }); // Override flame to avoid instant re-trigger
            }

            // 2. FORCE turn off physical buzzer and set safe LED for KCM
            // We await this to ensure the command is sent before UI navigation
            await monitorApi.sendCommand({ buzzer: 'OFF', led: 'GREEN' });
            console.log("[FireDetected] Physical buzzer command 'OFF' sent.");

            // 3. Increase gas threshold by 100 to avoid immediate re-triggering
            const thresholdsRes = await monitorApi.getThresholds();
            if (thresholdsRes.success && thresholdsRes.data.gas) {
                const currentWarning = thresholdsRes.data.gas.warning;
                await monitorApi.updateThreshold('gas', 'warning', currentWarning + 100);
                console.log(`[FireDetected] Increased gas warning threshold to ${currentWarning + 100}`);
            }

            // 4. Navigate home immediately
            route.replace("/(tabs)");
        } catch (err) {
            console.error("Failed to process handleSafe:", err);
            // Fallback navigation even if API fails
            route.replace("/(tabs)");
        }
    };

    return (
        <View className="flex-1 pt-12 px-6 items-center" style={{ backgroundColor: isDarkMode ? "#000000" : "#FFFFFF" }}>
            {/* Top Icon */}
            <View className="w-24 h-24 bg-[#E03131] rounded-full items-center justify-center mb-6 shadow-xl" style={{ elevation: 8 }}>
                <Flame size={48} color="white" />
            </View>

            {/* Title */}
            <Text className="text-[#E03131] text-4xl mb-2 text-center" style={styles.title}>Emergency Alert!</Text>
            <Text className={`${isDarkMode ? "text-gray-400" : "text-gray-600"} text-center mb-6`} style={styles.text}>
                Detected at: {location}
            </Text>

            {/* Fire Image */}
            <View className={`w-full aspect-video rounded-3xl mb-8 overflow-hidden border-2 ${isDarkMode ? "border-[#333]" : "border-gray-200"} bg-black shadow-2xl`}>
                {imageUrlRaw ? (
                    <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <AlertTriangle size={48} color="#666" />
                        <Text className="text-gray-500 mt-2">No image available</Text>
                    </View>
                )}
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-between w-full gap-4 mb-8">
                <TouchableOpacity
                    onPress={handleSafe}
                    activeOpacity={0.8}
                    className="flex-1 bg-[#2B8A3E] py-5 rounded-[22px] items-center shadow-lg justify-center"
                    style={{ elevation: 5 }}
                >
                    <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center mb-2">
                        <Check size={20} color="white" strokeWidth={3} />
                    </View>
                    <Text className="text-white text-xl font-bold" style={styles.subtitle}>It's Safe</Text>
                    <Text className="text-white/80 text-[10px] uppercase font-bold tracking-widest mt-1">Cooking / Test</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleDangerous}
                    activeOpacity={0.8}
                    className="flex-1 bg-[#E03131] py-5 rounded-[22px] items-center shadow-lg justify-center border-b-4 border-[#C92A2A]"
                    style={{ elevation: 5 }}
                >
                    <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center mb-2">
                        <X size={20} color="white" strokeWidth={3} />
                    </View>
                    <Text className="text-white text-xl font-bold" style={styles.subtitle}>Dangerous</Text>
                    <Text className="text-white/80 text-[10px] uppercase font-bold tracking-widest mt-1">Real Emergency</Text>
                </TouchableOpacity>
            </View>

            {/* Emergency Metadata */}
            <View className={`w-full p-5 rounded-3xl flex-row items-center justify-between ${isDarkMode ? "bg-[#1A1A1A]" : "bg-gray-50"}`}>
                <View>
                    <Text className="text-gray-500 text-[10px] font-bold uppercase mb-1">Emergency Contact</Text>
                    <Text className={`${isDarkMode ? "text-white" : "text-black"} font-bold text-lg`}>{user.emergencyContact || '999'}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${user.emergencyContact || '999'}`)}
                    className="w-12 h-12 bg-blue-500 rounded-2xl items-center justify-center shadow-sm"
                >
                    <Phone size={24} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

