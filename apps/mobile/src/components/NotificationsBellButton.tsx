import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useUnreadNotificationsCount } from "../hooks/useUnreadNotificationsCount";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { playHaptic } from "../utils/haptics";
import type { RootStackParamList } from "../navigation/types";
import { BELL_PIVOT_Y, BellBody, BellClapper, BellWaves } from "./icons/BellIcon";

const ICON = 26;
const PIVOT_SHIFT = ICON / 2 - (BELL_PIVOT_Y / 24) * ICON;

/**
 * Колокольчик без плашки: чистый векторный знак прямо на фоне (цвет текста). Есть непрочитанные —
 * контур и заливка окрашиваются цветом акцента, а в углу появляется точка со счётчиком (она
 * "выскакивает" пружиной и один раз выпускает кольцо). Когда счётчик растёт, корпус качается на
 * подвесе, язычок бьёт в противофазе, по бокам вспыхивают дуги звука — один раз, не по кругу.
 * Точка — цвета акцента, не красная: красный в приложении зарезервирован за срочностью.
 */
export function NotificationsBellButton() {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unreadCount = useUnreadNotificationsCount();
  const hasUnread = unreadCount > 0;

  const swing = useRef(new Animated.Value(0)).current;
  const waves = useRef(new Animated.Value(0)).current;
  const pip = useRef(new Animated.Value(hasUnread ? 1 : 0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(0);

  useEffect(() => {
    const grew = unreadCount > prevCount.current;
    prevCount.current = unreadCount;
    if (!hasUnread) {
      pip.setValue(0);
      return;
    }
    if (reduced) {
      pip.setValue(1);
      return;
    }
    if (grew) {
      playHaptic("tap");
      swing.setValue(0);
      waves.setValue(0);
      halo.setValue(0);
      Animated.parallel([
        Animated.spring(pip, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
        Animated.timing(halo, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(swing, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(swing, { toValue: -0.8, duration: 90, useNativeDriver: true }),
          Animated.timing(swing, { toValue: 0.57, duration: 90, useNativeDriver: true }),
          Animated.timing(swing, { toValue: -0.36, duration: 90, useNativeDriver: true }),
          Animated.timing(swing, { toValue: 0.14, duration: 90, useNativeDriver: true }),
          Animated.timing(swing, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(waves, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(waves, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      pip.setValue(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, reduced]);

  const bodyRotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ["-14deg", "14deg"] });
  // Язычок отстаёт от корпуса и бьёт в противофазе с большей амплитудой.
  const clapperRotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ["22deg", "-22deg"] });
  const pivot = (rotate: Animated.AnimatedInterpolation<string>) => ({
    transform: [{ translateY: -PIVOT_SHIFT }, { rotate }, { translateY: PIVOT_SHIFT }],
  });
  const wavesOpacity = waves.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] });
  const pipScale = pip.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });

  const label = hasUnread ? `${t("notifications.title")}: ${unreadCount}` : t("notifications.title");
  const ink = hasUnread ? theme.colors.primary : theme.colors.text;
  const pipInk = theme.colors.onPrimary;

  return (
    <Pressable
      onPress={() => navigation.navigate("Notifications")}
      onPressIn={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 8 }).start()}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.button, { cursor: "pointer" }]}
    >
      <Animated.View style={[styles.stage, { transform: [{ scale: pressScale }] }]}>
        <Animated.View style={[styles.layer, { opacity: wavesOpacity }]}>
          <BellWaves size={ICON} color={theme.colors.primary} />
        </Animated.View>
        <Animated.View style={[styles.layer, pivot(bodyRotate)]}>
          <BellBody size={ICON} color={ink} active={hasUnread} />
        </Animated.View>
        <Animated.View style={[styles.layer, pivot(clapperRotate)]}>
          <BellClapper size={ICON} color={ink} />
        </Animated.View>
      </Animated.View>

      {hasUnread ? (
        <View style={styles.pipSlot} pointerEvents="none">
          <Animated.View style={[styles.halo, { backgroundColor: theme.colors.primary, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
          <Animated.View
            style={[styles.pip, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background, transform: [{ scale: pipScale }] }]}
          >
            <Text style={[styles.pipText, { color: pipInk }]}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </Animated.View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44x44 — минимальный touch-таргет, сам знак 26px.
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stage: { width: ICON, height: ICON },
  layer: { position: "absolute", top: 0, left: 0 },
  pipSlot: { position: "absolute", top: 3, right: 1, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 18, height: 18, borderRadius: 9 },
  pip: { minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  pipText: { fontSize: 9.5, fontWeight: "800" },
});
