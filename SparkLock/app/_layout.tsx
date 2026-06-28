import {
  Outfit_100Thin,
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";
import { userStore } from "../utils/userStore";
import "./global.css";

import { ThemeProvider } from "../utils/themeContext";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { useCameraAlerts, useMonitorManager } from "../utils/useMonitorData";
import { useRouter } from "expo-router";

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

function FireAlertHandler({ children }: { children: React.ReactNode }) {
  const alerts = useCameraAlerts();
  const router = useRouter();
  const [lastAlertId, setLastAlertId] = useState<number | null>(null);

  useEffect(() => {
    if (alerts && alerts.length > 0) {
      const latest = alerts[0];
      if (lastAlertId !== null && latest.id > lastAlertId) {
        router.push({
          pathname: "/fire-detected",
          params: {
            imageUrl: latest.image_url,
            location: latest.location,
            gasValue: latest.gas_value?.toString() || ""
          }
        });
      }
      setLastAlertId(latest.id);
    }
  }, [alerts]);

  return <>{children}</>;
}

export default function RootLayout() {
  useMonitorManager();

  const [fontsLoaded] = useFonts({
    Outfit_100Thin,
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      userStore.loadStoredUser().finally(() => {
        SplashScreen.hideAsync().catch(() => { });
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FireAlertHandler>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#ffffff" },
            }}
          />
        </FireAlertHandler>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
