import { useFocusEffect, useRouter } from "expo-router";
import { AlertTriangle, Clock, Flame, MapPin, ShieldCheck, User as UserIcon, Zap } from "lucide-react-native";
import { useCallback, useState, useEffect } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../utils/themeContext";
import { userStore } from "../../utils/userStore";
import { styles } from "../index";

import { historyApi } from "../../utils/api";

const EventIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'alert': return <Flame size={14} color="#D66A1F" />;
        case 'warning': return <AlertTriangle size={14} color="#D66A1F" />;
        case 'safe': return <ShieldCheck size={14} color="#34C759" />;
        default: return <Zap size={14} color="#D66A1F" />;
    }
};

const getBadgeBg = (type: string, isDarkMode: boolean) => {
    if (isDarkMode) return 'bg-[#331A0A]';
    return 'bg-[#FDF0E7]';
};

const getBadgeText = (type: string) => {
    return 'text-[#D66A1F]';
};

export default function EventHistory() {
    const route = useRouter();
    const insets = useSafeAreaInsets();
    const { isDarkMode } = useTheme();
    const user = userStore.getUser();

    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchHistory = async () => {
            try {
                const res = await historyApi.getEvents(0, 50);
                if (!isMounted) return;

                if (res && res.success && Array.isArray(res.data)) {
                    const parsedEvents = res.data.map((item: any) => {
                        // Backend returns createdAt (LocalDateTime serialized as array or string)
                        let d: Date;
                        if (Array.isArray(item.createdAt)) {
                            // Spring serializes LocalDateTime as [year, month, day, hour, minute, second, nano]
                            const [y, mo, da, h, mi, s] = item.createdAt;
                            d = new Date(y, mo - 1, da, h, mi, s);
                        } else {
                            d = new Date(item.createdAt || item.timestamp);
                        }
                        const isValidDate = !isNaN(d.getTime());

                        let type = 'safe';
                        const sev = (item.severity || '').toUpperCase();
                        const typ = (item.type || '').toUpperCase();
                        if (sev === 'CRITICAL' || typ.includes('FIRE') || typ.includes('FLAME')) type = 'alert';
                        else if (sev === 'WARNING') type = 'warning';

                        const rawTitle = item.type?.replace(/_/g, ' ') || 'System Event';
                        const title = rawTitle.split(' ').map((w: string) =>
                            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                        ).join(' ');

                        return {
                            id: item.id.toString(),
                            type,
                            title,
                            date: isValidDate ? d.toISOString().split('T')[0] : '----',
                            desc: item.message || 'System event recorded.',
                            location: item.location || 'Building',
                            time: isValidDate
                                ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
                                : '--:--',
                        };
                    });
                    setEvents(parsedEvents);
                }
            } catch (err) {
                console.error('[History] Fetch failed:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchHistory();
        const interval = setInterval(fetchHistory, 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: isDarkMode ? "#000000" : "#FDFDFD" }}>
            {/* Top Header */}
            <View className={`px-6 flex-row justify-between items-center pb-2 z-10`} style={{ backgroundColor: isDarkMode ? "#000000" : "#FDFDFD" }}>
                <View>
                    <Text className="text-[#D66A1F] text-2xl font-bold" style={styles.title}>SPARKLOCK</Text>
                    <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-sm`} style={styles.text}>{user.location || "Kigali, Rwanda"}</Text>
                </View>
                <TouchableOpacity onPress={() => route.push("/(tabs)/profile")} className={`w-10 h-10 rounded-full border border-[#D66A1F]/30 ${isDarkMode ? "bg-[#333]" : "bg-[#FAEBE4]"} items-center justify-center overflow-hidden`}>
                    {user.profileImage ? (
                        <Image source={{ uri: user.profileImage }} className="w-full h-full" />
                    ) : (
                        <UserIcon size={20} color="#D66A1F" />
                    )}
                </TouchableOpacity>
            </View>
            <View className={`h-[1px] w-full ${isDarkMode ? "bg-[#333]" : "bg-gray-200"} mb-4 z-10`} />

            {/* Title Section */}
            <View className={`px-6 mb-2 z-10`} style={{ backgroundColor: isDarkMode ? "#000000" : "#FDFDFD" }}>
                <Text className={`text-[32px] font-bold mb-1 ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>Event History</Text>
                <Text className={`${isDarkMode ? "text-gray-500" : "text-[#888]"} text-[14px]`} style={styles.text}>Review past system activities.</Text>
            </View>

            <View className="flex-1 px-2 relative">
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    className="flex-1 z-10"
                    contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
                >
                    {/* SVG Timeline curve */}
                    <View className="absolute left-[34px] top-0 bottom-0 w-[40px] z-0 overflow-visible" pointerEvents="none">
                        <Svg height="1200" width="40" viewBox="0 0 40 1200">
                            <Path
                                d="M20,0 Q35,40 20,80 T20,160 T20,240 T20,320 T20,400 T20,480 T20,560 T20,640 T20,720 T20,800 T20,880"
                                fill="none"
                                stroke={isDarkMode ? "#333" : "#666"}
                                strokeWidth="1"
                            />
                        </Svg>
                    </View>

                    {loading ? (
                        <Text className={`text-center mt-10 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>Loading history...</Text>
                    ) : events.length === 0 ? (
                        <Text className={`text-center mt-10 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>No history events found.</Text>
                    ) : (
                        events.map((evt, index) => (
                            <View key={evt.id} className="flex-row items-start mb-4 min-h-[140px]">
                                {/* Timeline Node */}
                                <View className="w-[68px] items-center mt-6">
                                    <View className={`w-4 h-4 rounded-full bg-[#D66A1F] items-center justify-center`} />
                                </View>

                                {/* Card Content */}
                                <View className={`flex-1 ${isDarkMode ? "bg-[#1A1A1A]" : "bg-white"} rounded-[16px] p-4 mr-4 border border-[#D66A1F]/40`}>
                                    {/* Label & Date */}
                                    <View className="flex-row justify-between items-center mb-4">
                                        <View className={`${getBadgeBg(evt.type, isDarkMode)} px-2.5 py-1.5 rounded-md flex-row items-center gap-1.5`}>
                                            <EventIcon type={evt.type} />
                                            <Text className={`${getBadgeText(evt.type)} text-[13px] font-medium capitalize`} style={styles.text}>{evt.title}</Text>
                                        </View>
                                        <Text className={`${isDarkMode ? "text-gray-300" : "text-black"} text-[13px] font-bold`} style={styles.text}>{evt.date}</Text>
                                    </View>

                                    {/* Description */}
                                    <Text className={`text-[14px] mb-5 leading-5 ${isDarkMode ? "text-gray-300" : "text-[#333]"}`} style={styles.text}>
                                        {evt.desc}
                                    </Text>

                                    {/* Metadata Row */}
                                    <View className="flex-row items-center justify-start gap-8 mt-auto">
                                        <View className="flex-row items-center gap-1.5">
                                            <MapPin size={16} color="#ef4444" />
                                            <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-[13px]`} style={styles.text}>{evt.location}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-1.5">
                                            <Clock size={16} color="#ef4444" />
                                            <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-[13px]`} style={styles.text}>{evt.time}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </View>
    );
}


