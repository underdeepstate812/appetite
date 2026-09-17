import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import User from "lucide-react-native/icons/user";
import MapPin from "lucide-react-native/icons/map-pin";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import { useTheme } from "../theme/ThemeProvider";
import { AppetiteMark } from "./icons/AppetiteMark";

/**
 * Хедер главного экрана из брифа: [👤 Профиль] [📍 геолокация] [Корзина] —
 * без эмодзи-иконок (см. рефреш web из этой же серии правок), плюс новый
 * фирменный знак вместо текстового заголовка "Предложения рядом".
 *
 * "Корзина" здесь ведёт на "Мои заказы" — в продукте нет multi-item корзины
 * (флоу всегда: один оффер → бронь → самовывоз, см. RootStackParamList），
 * так что честнее задействовать существующий экран, чем рисовать неработающую
 * корзину.
 */
export function HomeHeader({
  locationLabel,
  onPressProfile,
  onPressOrders,
}: {
  locationLabel: string | null;
  onPressProfile: () => void;
  onPressOrders: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPressProfile}
        hitSlop={8}
        style={[styles.avatarChip, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.full }]}
      >
        <User size={18} color={theme.colors.primary} strokeWidth={2.2} />
      </Pressable>

      <View style={styles.centerWrap}>
        <AppetiteMark size={20} />
        <View style={styles.locationWrap}>
          <MapPin size={12} color={theme.colors.textMuted} strokeWidth={2.2} />
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {locationLabel ?? "…"}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onPressOrders}
        hitSlop={8}
        style={[styles.avatarChip, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.full }]}
      >
        <ShoppingBag size={18} color={theme.colors.text} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  avatarChip: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  centerWrap: { alignItems: "center", gap: 2 },
  locationWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
});
