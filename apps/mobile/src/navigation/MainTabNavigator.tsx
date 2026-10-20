import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { HomeScreen } from "../screens/home/HomeScreen";
import { MapScreen } from "../screens/map/MapScreen";
import { OrdersScreen } from "../screens/orders/OrdersScreen";
import { EcoProfileScreen } from "../screens/eco-profile/EcoProfileScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { TabDock } from "../components/TabDock";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabDock {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("nav.home") }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t("nav.map") }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: t("nav.orders") }} />
      <Tab.Screen name="EcoProfile" component={EcoProfileScreen} options={{ title: t("nav.eco") }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("nav.profile") }} />
    </Tab.Navigator>
  );
}
