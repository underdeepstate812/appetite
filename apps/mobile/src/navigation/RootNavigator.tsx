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
import { LoadingView } from "../components/StateViews";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const user = useAuthStore((state) => state.user);

  if (!isHydrated) {
    return <LoadingView label={t("common.loading")} />;
  }

  if (!user) {
    return <AuthNavigator />;
  }

  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} options={{ title: t("offerDetail.title") }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: t("checkout.title") }} />
      <Stack.Screen
        name="OrderConfirmation"
        component={OrderConfirmationScreen}
        options={{ title: t("orderConfirmation.title"), headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: t("orderDetail.title") }} />
    </Stack.Navigator>
  );
}
