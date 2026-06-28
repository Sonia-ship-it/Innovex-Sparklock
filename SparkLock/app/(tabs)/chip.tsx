import { useFocusEffect, useRouter } from "expo-router";
import { Flame, Plus, User as UserIcon, Zap, AlertCircle, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../utils/themeContext";
import { userStore } from "../../utils/userStore";
import { useMonitorData } from "../../utils/useMonitorData";
import { monitorApi } from "../../utils/api";
import { styles } from "../index";

export default function ElectricalControls() {
    const [showModal, setShowModal] = useState(false);
    const route = useRouter();
    const insets = useSafeAreaInsets();
    const { isDarkMode } = useTheme();
    const [user, setUser] = useState(userStore.getUser());
    
    // Get real monitor data
    const { pcmData, kcmData } = useMonitorData();
    const [category, setCategory] = useState("All");

    useFocusEffect(
        useCallback(() => {
            setUser(userStore.getUser());
        }, [])
    );

    const handleTogglePower = async (itemType: string, currentStatus: boolean) => {
        if (itemType === 'pcm') {
            if (currentStatus) {
                await monitorApi.killPower().catch(console.error);
            } else {
                await monitorApi.restorePower().catch(console.error);
            }
        }
    };

    // Construct cards from real data
    const controlCards = [];
    
    if (pcmData) {
        const isRelayOn = pcmData.relay === 'ON';
        controlCards.push({
            id: 'pcm',
            type: 'pcm',
            name: 'Main Electrical Line',
            location: pcmData.location || "Building",
            status: isRelayOn,
            value: pcmData.current || 0,
            unit: 'AMPS',
            message: pcmData.led === 'RED' ? "High load or fault detected." : "Operating normally.",
            icon: Zap
        });
    }

    if (kcmData) {
        controlCards.push({
            id: 'kcm',
            type: 'kcm',
            name: 'Kitchen Fire Monitor',
            location: kcmData.location || "Kitchen",
            status: true, // always monitoring
            value: kcmData.gas_value || 0,
            unit: 'PPM (Gas)',
            message: kcmData.flame === 1 ? "Flame detected in kitchen!" : "Operating normally.",
            icon: Flame
        });
    }
    
    const filteredCards = controlCards.filter(card => {
        if (category === "All") return true;
        return card.location === category;
    });

    const categories = ["All", ...new Set(controlCards.map(c => c.location))];

    return (
        <View className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} relative`} style={{ paddingTop: insets.top }}>
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
                        <UserIcon size={20} color="#D66A1F" />
                    )}
                </TouchableOpacity>
            </View>
            <View className={`h-[1px] w-full ${isDarkMode ? "bg-[#333]" : "bg-gray-200"} mb-6`} />

            {/* Title Section */}
            <View className="px-6 flex-row justify-between items-center mb-6">
                <View>
                    <Text className={`text-3xl mb-1 ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>Electrical Controls</Text>
                    <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-sm`} style={styles.text}>Real-time building safety status</Text>
                </View>
                <TouchableOpacity onPress={() => setShowModal(true)} className="w-12 h-12 rounded-full bg-[#D66A1F] items-center justify-center shadow-sm">
                    <Plus size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* Categories */}
            <View className="pl-6 mb-8">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible pb-2" contentContainerStyle={{ gap: 12 }}>
                    {categories.map((cat, idx) => (
                        <TouchableOpacity 
                            key={idx} 
                            onPress={() => setCategory(cat)}
                            className={`${cat === category ? "bg-[#D66A1F]" : (isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-white border-gray-100")} px-5 py-2.5 rounded-lg shadow-sm border`} 
                            style={{ elevation: 2 }}>
                            <Text className={`${cat === category ? "text-white" : (isDarkMode ? "text-[#AAA]" : "text-[#464646FF]")} text-base`} style={styles.subtitle}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                    <View className="w-4" />
                </ScrollView>
            </View>

            {/* Cards List */}
            <ScrollView className="px-6 flex-1 mb-24" showsVerticalScrollIndicator={false}>
                {filteredCards.length === 0 ? (
                    <Text className={`text-center mt-10 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>No devices connected.</Text>
                ) : (
                    filteredCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <View key={card.id} className={`${isDarkMode ? "bg-[#1A1A1A]" : "bg-white"} rounded-2xl p-5 mb-5 shadow-sm`} style={{ elevation: 2 }}>
                                <View className="flex-row justify-between items-center mb-4">
                                    <View className="flex-row items-center gap-3">
                                        <View className={`${isDarkMode ? "bg-[#333]" : "bg-[#FAEBE4]"} w-10 h-10 rounded-lg items-center justify-center`}>
                                            <Icon size={20} color="#D66A1F" />
                                        </View>
                                        <View>
                                            <Text className={`font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`} style={styles.subtitle}>{card.name}</Text>
                                            <Text className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`} style={styles.text}>{card.location}</Text>
                                        </View>
                                    </View>
                                    
                                    {card.type === 'pcm' && (
                                        <TouchableOpacity
                                            onPress={() => handleTogglePower(card.type, card.status)}
                                            className={`w-[52px] h-[28px] rounded-full p-1 justify-center ${card.status ? 'bg-[#D66A1F]' : (isDarkMode ? 'bg-[#333]' : 'bg-gray-400')}`}
                                        >
                                            <View className={`w-[20px] h-[20px] rounded-full bg-white ${card.status ? 'self-end' : 'self-start'}`} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <Text className={`text-sm mb-4 leading-5 ${isDarkMode ? "text-gray-400" : "text-[#464646FF]"}`} style={styles.text}>
                                    {card.message}
                                </Text>

                                <View className="flex-row items-end pb-1">
                                    <Text className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>{card.value.toFixed(2)}</Text>
                                    <Text className="text-xs text-[#666] mb-1 ml-1 font-bold" style={styles.subtitle}>{card.unit}</Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <Modal visible={showModal} transparent animationType="fade">
                <View className="flex-1 bg-black/60 justify-center items-center px-6">
                    <View className={`${isDarkMode ? "bg-[#1A1A1A] border border-[#333]" : "bg-white"} w-full rounded-3xl p-6 pt-10 pb-8 items-center shadow-lg relative`} style={{ elevation: 5 }}>
                        <TouchableOpacity 
                            onPress={() => setShowModal(false)} 
                            className="absolute top-5 right-5 p-2"
                        >
                            <X size={24} color={isDarkMode ? "#999" : "#666"} />
                        </TouchableOpacity>
                        <Text className="text-[#D66A1F] text-4xl mb-3" style={styles.title}>Add Room</Text>
                        <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-center text-[15px] mb-8 leading-6 px-4`} style={styles.text}>
                            This is your unique QR code for another person to scan
                        </Text>

                        <View className="w-full gap-5 mb-8">
                            <TextInput
                                placeholder="Room Name"
                                placeholderTextColor={isDarkMode ? "#555" : "#9FA5AA"}
                                className={`w-full border rounded-xl p-4 text-base ${isDarkMode ? "border-[#333] bg-[#222] text-white" : "border-gray-200 bg-white text-gray-800"}`}
                                style={styles.text}
                            />
                            <TextInput
                                placeholder="Room Location"
                                placeholderTextColor={isDarkMode ? "#555" : "#9FA5AA"}
                                className={`w-full border rounded-xl p-4 text-base ${isDarkMode ? "border-[#333] bg-[#222] text-white" : "border-gray-200 bg-white text-gray-800"}`}
                                style={styles.text}
                            />
                        </View>

                        <TouchableOpacity onPress={() => setShowModal(false)} className="w-[80%] bg-[#D66A1F] py-4 rounded-xl items-center shadow-sm">
                            <Text className="text-white text-xl" style={styles.title}>Add Room</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

