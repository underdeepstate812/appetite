import "./src/i18n";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, type NavigationContainerRef } from "@react-navigation/native";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { buildNavigationTheme } from "./src/theme/navigationTheme";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { linking } from "./src/navigation/linking";
import { useAuthStore } from "./src/store/authStore";
import { useLanguageStore } from "./src/store/languageStore";
import { usePushNotifications } from "./src/hooks/usePushNotifications";
import { ConfirmHost } from "./src/components/ConfirmHost";
import type { RootStackParamList } from "./src/navigation/types";

function AppContent() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  usePushNotifications(navigationRef, !!user);

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={buildNavigationTheme(theme)} linking={Platform.OS === "web" ? linking : undefined}>
        <RootNavigator />
      </NavigationContainer>
      <ConfirmHost />
    </>
  );
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateLanguage();
  }, [hydrate, hydrateLanguage]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
