import { Tabs } from "expo-router";
import { BarChart2, Cpu, FileUp, Home, Settings } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View, Modal, Text } from "react-native";
import Animated, {
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from "react-native-reanimated";
import Svg, { Defs, G, Mask, Path, Rect } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEIGHT = 90; // Optimized height for the "down bg"
const CIRCLE_SIZE = 64;
const PRIMARY_COLOR = "#D66A1F"; // Updated orange color as requested

import { useTheme } from "../../utils/themeContext";
import { useMonitorData } from "../../utils/useMonitorData";
import { useMonitorStore, monitorStore } from "../../utils/monitorStore";
import { monitorApi } from "../../utils/api";
import { styles } from "../index";
import { AlertTriangle } from "lucide-react-native";

const AnimatedG = Animated.createAnimatedComponent(G);

import { withSpring } from "react-native-reanimated";

const TabItem = React.memo(({ route, index, activeIndex, navigation, PRIMARY_COLOR }: any) => {
    const isFocused = activeIndex === index;

    const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    let Icon = Home;
    if (route.name === 'monitor') Icon = BarChart2;
    if (route.name === 'settings') Icon = Settings;
    if (route.name === 'chip') Icon = Cpu;
    if (route.name === 'docs') Icon = FileUp;

    return (
        <TouchableOpacity
            key={index}
            activeOpacity={0.7}
            onPress={onPress}
            style={navStyles.tabItem}
            hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}
        >
            <View style={{ transform: [{ translateY: isFocused ? -45 : 0 }] }}>
                <Icon
                    color={isFocused ? PRIMARY_COLOR : "#FFFFFF"}
                    size={28}
                    strokeWidth={isFocused ? 3 : 2.5}
                />
            </View>
        </TouchableOpacity>
    );
});

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    const routesToDisplay = state.routes.slice(0, 5);
    const tabWidth = SCREEN_WIDTH / 5;
    const activeIndex = state.index < 5 ? state.index : 0;

    const translateX = useSharedValue(activeIndex * tabWidth);

    useEffect(() => {
        translateX.value = withSpring(activeIndex * tabWidth, {
            damping: 20,
            stiffness: 150,
            mass: 0.5,
        });
    }, [activeIndex]);

    const holePath = useMemo(() => {
        const center = tabWidth / 2;
        const w = 48; // Width factor for U-shape
        const h = 42; // Deep U-shape depth

        return `M ${center - w} 0 C ${center - w * 0.7} 0, ${center - w * 0.6} ${h}, ${center} ${h} S ${center + w * 0.7} 0, ${center + w} 0 L ${center + w} 0 Z`;
    }, [tabWidth]);

    const animatedNotchProps = useAnimatedProps(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const animatedFabStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={navStyles.container} pointerEvents="box-none">
            <View style={navStyles.notchContainer} pointerEvents="none">
                <Svg width={SCREEN_WIDTH} height={500}>
                    <Defs>
                        <Mask id="notchMask">
                            <Rect x="0" y="0" width={SCREEN_WIDTH} height={500} fill="white" />
                            <AnimatedG animatedProps={animatedNotchProps}>
                                <Path d={holePath} fill="black" />
                            </AnimatedG>
                        </Mask>
                    </Defs>
                    <Rect
                        x="0"
                        y="0"
                        width={SCREEN_WIDTH}
                        height={500}
                        fill={PRIMARY_COLOR}
                        mask="url(#notchMask)"
                        rx={24}
                        ry={24}
                    />
                </Svg>
            </View>

            <Animated.View style={[navStyles.fabWrapper, animatedFabStyle, { width: tabWidth }]} pointerEvents="none">
                <View style={navStyles.whiteCircle} />
            </Animated.View>

            <View style={navStyles.iconsContainer} pointerEvents="box-none">
                {routesToDisplay.map((route: any, index: number) => (
                    <TabItem
                        key={route.key}
                        route={route}
                        index={index}
                        activeIndex={activeIndex}
                        navigation={navigation}
                        PRIMARY_COLOR={PRIMARY_COLOR}
                    />
                ))}
            </View>
        </View>
    );
};

export default function TabLayout() {
    const { isDarkMode } = useTheme();
    const { pcmData } = useMonitorData();
    const { isSilenced } = useMonitorStore();

    // Latch onto the backend's persistent RED led state which signifies a tripped alarm
    const isAlarmActive = pcmData?.led === 'RED' && !isSilenced;

    const handleSilenceAlarm = async () => {
        monitorStore.setIsSilenced(true);
        try {
            await monitorApi.sendCommand({ buzzer: 'OFF' });
        } catch (error) {
            console.error("Failed to silence buzzer:", error);
        }
    };

    return (
        <>
            <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
                <Tabs.Screen name="index" options={{ title: "Home" }} />
                <Tabs.Screen name="monitor" options={{ title: "Monitor" }} />
                <Tabs.Screen name="settings" options={{ title: "Settings" }} />
                <Tabs.Screen name="chip" options={{ title: "CPU" }} />
                <Tabs.Screen name="docs" options={{ title: "Docs" }} />
                <Tabs.Screen name="profile" options={{ href: null }} />
            </Tabs>

            <Modal visible={isAlarmActive} transparent animationType="fade">
                <View className="flex-1 bg-black/70 justify-center items-center px-6">
                    <View className={`${isDarkMode ? "bg-[#1A1A1A] border border-red-900/50" : "bg-white"} w-full rounded-3xl p-6 pt-8 pb-8 items-center shadow-2xl relative`} style={{ elevation: 10 }}>
                        <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-5 shadow-sm">
                            <AlertTriangle size={36} color="#DC2626" />
                        </View>
                        <Text className="text-red-600 text-3xl mb-2 font-bold text-center" style={styles.title}>POWER CUT</Text>
                        <Text className={`${isDarkMode ? "text-gray-400" : "text-[#666]"} text-center text-[15px] mb-8 leading-6 px-2`} style={styles.text}>
                            High current detected. The main power relay has been disconnected for your safety.
                        </Text>

                        <TouchableOpacity onPress={handleSilenceAlarm} className="w-[90%] bg-red-600 py-4 rounded-xl items-center shadow-md">
                            <Text className="text-white text-lg font-bold tracking-wide" style={styles.title}>Silence Alarm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const navStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: HEIGHT,
        backgroundColor: 'transparent',
    },
    notchContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 500, // Overflowing to handle safe area
    },
    fabWrapper: {
        position: 'absolute',
        top: -45, // Raised for that premium "hollow" reveal
        alignItems: 'center',
        justifyContent: 'center',
    },
    whiteCircle: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        backgroundColor: 'white',
        // Enhanced shadow to make it "outstand"
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 12,
        // Subtle border to help it pop
        borderWidth: 1,
        borderColor: 'rgba(216, 89, 27, 0.1)',
    },
    iconsContainer: {
        flexDirection: 'row',
        height: HEIGHT,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        paddingBottom: 15, // Push icons up slightly for thicker "down bg"
    }
});