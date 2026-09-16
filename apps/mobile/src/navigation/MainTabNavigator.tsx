import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { HomeScreen } from "../screens/home/HomeScreen";
import { MapScreen } from "../screens/map/MapScreen";
import { OrdersScreen } from "../screens/orders/OrdersScreen";
import { EcoProfileScreen } from "../screens/eco-profile/EcoProfileScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { useTheme } from "../theme/ThemeProvider";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: "🔥",
  Map: "🗺️",
  Orders: "🧾",
  EcoProfile: "🌱",
  Profile: "👤",
};

export function MainTabNavigator() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{TAB_ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("nav.home") }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t("nav.map") }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: t("nav.orders") }} />
      <Tab.Screen name="EcoProfile" component={EcoProfileScreen} options={{ title: t("nav.eco") }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("nav.profile") }} />
    </Tab.Navigator>
  );
}
