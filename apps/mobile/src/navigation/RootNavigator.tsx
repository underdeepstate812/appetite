import React from "react";
import { useTranslation } from "react-i18next";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/authStore";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";
import { OfferDetailScreen } from "../screens/offer-detail/OfferDetailScreen";
import { CheckoutScreen } from "../screens/checkout/CheckoutScreen";
import { OrderConfirmationScreen } from "../screens/order-confirmation/OrderConfirmationScreen";
import { OrderDetailScreen } from "../screens/order-detail/OrderDetailScreen";
import { NotificationsScreen } from "../screens/notifications/NotificationsScreen";
import { LoadingView } from "../components/StateViews";
import { BackButton } from "../components/BackButton";
import { useTheme } from "../theme/ThemeProvider";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const user = useAuthStore((state) => state.user);

  if (!isHydrated) {
    return <LoadingView label={t("common.loading")} />;
  }

  if (!user) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        // Своя кнопка "назад" (BackButton) вместо системной стрелки с подписью.
        headerBackVisible: false,
        // Кастомный headerLeft на iOS может отключить свайп-назад: возвращаем его на весь экран.
        fullScreenGestureEnabled: true,
        headerLeft: ({ canGoBack }) => (canGoBack ? <BackButton onPress={navigation.goBack} /> : null),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { ...theme.fonts.bold, fontSize: 15, color: theme.colors.text },
      })}
    >
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} options={{ title: t("offerDetail.title") }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t("checkout.title") }} />
      <Stack.Screen
        name="OrderConfirmation"
        component={OrderConfirmationScreen}
        options={{ title: t("orderConfirmation.title"), headerLeft: () => null, gestureEnabled: false }}
      />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: t("orderDetail.title") }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t("notifications.title") }} />
    </Stack.Navigator>
  );
}
