import { useFocusEffect, useRouter } from "expo-router";
import { User as UserIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../utils/themeContext";
import { useHistoricalData, useCameraAlerts } from "../../utils/useMonitorData";
import { userStore } from "../../utils/userStore";
import { MONITOR_API_BASE_URL } from "../../utils/api";
import { styles } from "../index";
import { AlertTriangle, MapPin, Camera, Flame } from "lucide-react-native";

const X_POINTS = [50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325];

const mapToY = (val: number, isCurrent: boolean) => {
    const safeVal = Number.isFinite(val) ? val : 0;
    if (isCurrent) {
        // Current mapping: 0 -> 190, 2.5 -> 30
        return Math.max(30, Math.min(190, 190 - (safeVal / 2.5) * 160));
    } else {
        // Temp mapping: 0 -> 190, 30 -> 30
        return Math.max(30, Math.min(190, 190 - (safeVal / 30) * 160));
    }
};

const createArea = (xs: number[], ys: number[], base: number) => {
    let p = `M${xs[0]},${base} L${xs[0]},${ys[0]}`;
    for (let i = 1; i < xs.length; i++) p += ` L${xs[i]},${ys[i]}`;
    p += ` L${xs[xs.length - 1]},${base} Z`;
    return p;
};

const createLine = (xs: number[], ys: number[]) => {
    let p = `M${xs[0]},${ys[0]}`;
    for (let i = 1; i < xs.length; i++) p += ` L${xs[i]},${ys[i]}`;
    return p;
};

const FireStatusSection = ({ alerts }: { alerts: any[] }) => {
    const { isDarkMode } = useTheme();
    const latestAlert = alerts && alerts.length > 0 ? alerts[0] : null;

    if (!latestAlert) return null;

    const isConfirmed = latestAlert.fire_confirmed;
    const imageUrl = latestAlert.image_url.startsWith('http')
        ? latestAlert.image_url
        : `${MONITOR_API_BASE_URL}${latestAlert.image_url}`;

    return (
        <View className={`mb-10 rounded-[28px] overflow-hidden ${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-white border-gray-100"} border shadow-sm`}>
            {/* Header Status */}
            <View className={`px-5 py-4 flex-row justify-between items-center ${isConfirmed ? 'bg-red-600' : 'bg-[#D66A1F]'}`}>
                <View className="flex-row items-center gap-2">
                    {isConfirmed ? <Flame color="white" size={20} /> : <AlertTriangle color="white" size={20} />}
                    <Text className="text-white font-bold text-base" style={styles.title}>
                        {isConfirmed ? "FIRE CONFIRMED" : "ABNORMAL ACTIVITY"}
                    </Text>
                </View>
                <View className="bg-white/20 px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-bold">
                        {new Date(latestAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>

            {/* Camera Frame */}
            <View className="p-4">
                <View className="aspect-video w-full rounded-2xl overflow-hidden bg-black relative">
                    <Image
                        source={{ uri: imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                    {/* Camera Badge Overlay */}
                    <View className="absolute top-3 left-3 bg-black/50 px-3 py-1 rounded-full flex-row items-center gap-2">
                        <Camera color="white" size={12} />
                        <Text className="text-white text-[10px] font-bold tracking-widest uppercase">Live Capture</Text>
                    </View>
                    <View className="absolute top-3 right-3 bg-red-600 px-2 py-1 rounded-sm flex-row items-center gap-1">
                        <View className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                        <Text className="text-white text-[10px] font-extrabold uppercase">Rec</Text>
                    </View>
                </View>

                {/* Details */}
                <View className="mt-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <MapPin size={14} color={isConfirmed ? "#FF3B30" : "#D66A1F"} />
                        <Text className={`${isDarkMode ? "text-gray-400" : "text-[#666]"} text-sm font-medium`} style={styles.text}>
                            {latestAlert.location || 'Camera Node 1'}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        {latestAlert.gas_value && (
                            <View className="items-end">
                                <Text className="text-[#888] text-[10px] font-bold uppercase">Gas</Text>
                                <Text className={`${isDarkMode ? "text-white" : "text-black"} text-sm font-black`}>{parseFloat(latestAlert.gas_value).toFixed(0)}ppm</Text>
                            </View>
                        )}
                        <View className={`w-[1px] h-6 ${isDarkMode ? "bg-[#333]" : "bg-gray-100"}`} />
                        <View className="items-end">
                            <Text className="text-[#888] text-[10px] font-bold uppercase">Condition</Text>
                            <Text className={`${isConfirmed ? "text-red-500" : "text-orange-500"} text-sm font-black`}>
                                {isConfirmed ? 'CRITICAL' : 'WARNING'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const ChartSection = ({ title, type, c1_y, c2_y, c3_y, t_y, timeLabels }: { title: string, type: 'current' | 'temp', c1_y: number[], c2_y: number[], c3_y: number[], t_y: number[], timeLabels: string[] }) => {
    const base = 190;
    const isCurrent = type === 'current';
    const { isDarkMode } = useTheme();

    return (
        <View className="mb-12">
            <Text className={`text-2xl mb-4 ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>{title}</Text>
            <View style={{ height: 260, width: '100%' }}>
                <Svg height="100%" width="100%" viewBox="0 0 350 240">
                    <Defs>
                        <LinearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#34C759" stopOpacity="0.2" /><Stop offset="1" stopColor="#34C759" stopOpacity="0" /></LinearGradient>
                        <LinearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#007AFF" stopOpacity="0.2" /><Stop offset="1" stopColor="#007AFF" stopOpacity="0" /></LinearGradient>
                        <LinearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#D66A1F" stopOpacity="0.2" /><Stop offset="1" stopColor="#D66A1F" stopOpacity="0" /></LinearGradient>
                        <LinearGradient id="gRed" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF3B30" stopOpacity="0.2" /><Stop offset="1" stopColor="#FF3B30" stopOpacity="0" /></LinearGradient>
                    </Defs>

                    {/* Grid and Axis Labels */}
                    {[0, 1, 2, 3, 4].map((i) => (
                        <G key={i}>
                            <SvgLine x1="50" y1={30 + i * 40} x2="330" y2={30 + i * 40} stroke={isDarkMode ? "#333" : "#EBEBEB"} strokeDasharray="4, 4" strokeWidth="1" />
                            <SvgText x="40" y={34 + i * 40} fontSize="10" fill={isDarkMode ? "#666" : "#8E8E93"} textAnchor="end" fontFamily="System">
                                {isCurrent ? (2.5 - i * 0.625).toFixed(1) : (30 - i * 7.5).toFixed(1)}
                            </SvgText>
                        </G>
                    ))}

                    {/* Vertical Axis Title */}
                    <SvgText x="-110" y="12" transform="rotate(-90)" fontSize="12" fill={isDarkMode ? "#666" : "#8E8E93"} textAnchor="middle" fontWeight="bold">
                        {isCurrent ? "Current (A)" : "Temperature (K)"}
                    </SvgText>

                    {/* Axis Lines */}
                    <SvgLine x1="50" y1="30" x2="50" y2={base} stroke={isDarkMode ? "#333" : "#EBEBEB"} strokeWidth="1" />
                    <SvgLine x1="50" y1={base} x2="340" y2={base} stroke={isDarkMode ? "#444" : "#D1D1D1"} strokeWidth="1.5" />

                    {/* X-Axis Time Labels */}
                    {timeLabels.map((t, i) => (
                        <SvgText key={`${t}-${i}`} x={50 + i * 50} y="205" fontSize="10" fill={isDarkMode ? "#666" : "#8E8E93"} textAnchor="middle">{t}</SvgText>
                    ))}

                    {isCurrent ? (
                        <>
                            <Path d={createArea(X_POINTS, c1_y, base)} fill="url(#gGreen)" />
                            <Path d={createLine(X_POINTS, c1_y)} fill="none" stroke="#34C759" strokeWidth="1.5" />
                        </>
                    ) : (
                        <>
                            <Path d={createArea(X_POINTS, t_y, base)} fill="url(#gRed)" />
                            <Path d={createLine(X_POINTS, t_y)} fill="none" stroke="#FF3B30" strokeWidth="1.5" />
                        </>
                    )}

                    {/* Markers for better visualization */}
                    {(isCurrent ? [c1_y] : [t_y]).map((ys, idx) => (
                        <G key={idx}>
                            {ys.map((y, i) => (
                                <Circle key={i} cx={X_POINTS[i]} cy={y} r="3" fill={isDarkMode ? "#222" : "white"} stroke={isCurrent ? ["#34C759", "#007AFF", "#D66A1F"][idx] : "#FF3B30"} strokeWidth="1" />
                            ))}
                        </G>
                    ))}

                    {/* Legend */}
                    <G transform="translate(85, 230)">
                        {isCurrent ? (
                            <>
                                <G transform="translate(0,0)"><SvgLine x1="0" y1="0" x2="12" y2="0" stroke="#34C759" strokeWidth="1.5" /><Circle cx="6" cy="0" r="2.5" fill={isDarkMode ? "#222" : "white"} stroke="#34C759" strokeWidth="1" /><SvgText x="16" y="4" fontSize="10" fill="#34C759">Circuit 1</SvgText></G>
                            </>
                        ) : (
                            <G transform="translate(60,0)">
                                <SvgLine x1="0" y1="0" x2="15" y2="0" stroke="#FF3B30" strokeWidth="1.5" />
                                <Circle cx="7.5" cy="0" r="3" fill={isDarkMode ? "#222" : "white"} stroke="#FF3B30" strokeWidth="1" />
                                <SvgText x="20" y="4" fontSize="10" fill="#FF3B30">Temperature</SvgText>
                            </G>
                        )}
                    </G>
                </Svg>
            </View>
        </View>
    );
};

export default function LiveMonitoring() {
    const route = useRouter();
    const insets = useSafeAreaInsets();
    const { isDarkMode } = useTheme();
    const user = userStore.getUser();

    return (
        <View className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"} relative`} style={{ paddingTop: insets.top }}>
            {/* Top Header */}
            <View className={`px-6 flex-row justify-between items-center pb-2 border-b ${isDarkMode ? "border-[#333]" : "border-gray-100"}`}>
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

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="px-6 mt-8 mb-4">
                    <Text className={`text-4xl ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>Live Monitoring</Text>
                    <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-base`} style={styles.text}>Real-time building safety status</Text>
                </View>

                <View className="px-6 mt-6">
                    {(() => {
                        const alerts = useCameraAlerts();
                        const history = useHistoricalData();
                        const defaultPoint = { current: 0, temperature: 24, timestamp: new Date().toISOString() };
                        const validHistory = (history && Array.isArray(history) && history.length > 0) ? history : [...Array(12)].map(() => defaultPoint);

                        // Ensure we always have exactly 12 points for the X_POINTS
                        const paddedHistory = validHistory.length < 12
                            ? [...Array(12 - validHistory.length).fill(validHistory[0] || defaultPoint), ...validHistory]
                            : validHistory.slice(-12);

                        const c1_y = paddedHistory.map(h => mapToY(h.current || 0, true));
                        const c2_y = paddedHistory.map(() => 190);
                        const c3_y = paddedHistory.map(() => 190);
                        const t_y = paddedHistory.map(h => mapToY(h.temperature || 24, false));

                        const rawLabels = paddedHistory.map(h => {
                            if (!h?.timestamp) return '--:--';
                            const d = new Date(h.timestamp);
                            return (isNaN(d.getTime())) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        });

                        const timeLabels = [
                            rawLabels[0] || '--:--',
                            rawLabels[2] || '--:--',
                            rawLabels[4] || '--:--',
                            rawLabels[6] || '--:--',
                            rawLabels[8] || '--:--',
                            rawLabels[10] || '--:--'
                        ];

                        return (
                            <>
                                <FireStatusSection alerts={alerts} />
                                <ChartSection title="Current vs Time" type="current" c1_y={c1_y} c2_y={c2_y} c3_y={c3_y} t_y={t_y} timeLabels={timeLabels} />
                                <ChartSection title="Temperature vs Time" type="temp" c1_y={c1_y} c2_y={c2_y} c3_y={c3_y} t_y={t_y} timeLabels={timeLabels} />
                            </>
                        );
                    })()}
                </View>
            </ScrollView>
        </View >
    );
}