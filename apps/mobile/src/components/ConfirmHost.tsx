import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useTheme } from "../theme/ThemeProvider";
import { registerConfirmHandler, type ConfirmRequest } from "../utils/confirm";
import { playHaptic } from "../utils/haptics";
import { Button } from "./Button";

const SHEET_OFFSET = 420;

/**
 * Шторка подтверждения вместо системного диалога/window.confirm: затемнение и лист
 * выезжают снизу пружиной, над заголовком — ember-значок с мягким свечением, а
 * опасное действие — отдельной красной кнопкой. Открытие даёт haptic "warning".
 * Монтируется один раз в корне приложения; confirmAction() находит её сам.
 */
export function ConfirmHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(
    () =>
      registerConfirmHandler((next) => {
        setRequest(next);
      }),
    []
  );

  useEffect(() => {
    if (!request) return;
    playHaptic("warning");
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
  }, [request, progress]);

  const close = useCallback(
    (confirmed: boolean) => {
      if (!request) return;
      const current = request;
      Animated.timing(progress, { toValue: 0, duration: 170, useNativeDriver: true }).start(() => {
        setRequest(null);
        current.resolve(confirmed);
      });
    },
    [request, progress]
  );

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSET, 0] });
  const backdrop = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible={!!request} transparent animationType="none" statusBarTranslucent onRequestClose={() => close(false)}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,10,9,0.62)", opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel={request?.cancelLabel} />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

          <View style={[styles.iconHalo, { backgroundColor: theme.colors.emberSoft, boxShadow: `0 0 26px ${theme.colors.ember}55` }]}>
            <TriangleAlert size={26} color={theme.colors.ember} strokeWidth={2.2} />
          </View>

          <Text style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}>{request?.title}</Text>
          <Text style={[theme.typography.body, styles.message, { color: theme.colors.textMuted }]}>{request?.message}</Text>

          <View style={styles.actions}>
            {/* Безопасное действие — акцентное, опасное — тонированное с контуром, а не сплошной красный. */}
            <Button title={request?.cancelLabel ?? ""} variant="primary" haptic="none" onPress={() => close(false)} />
            <Button title={request?.confirmLabel ?? ""} variant="dangerSoft" haptic="none" onPress={() => close(true)} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 22,
    paddingTop: 10,
    alignItems: "center",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  handle: { width: 42, height: 4, borderRadius: 2, marginBottom: 20 },
  iconHalo: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { textAlign: "center" },
  message: { textAlign: "center", marginTop: 8, marginBottom: 22 },
  actions: { alignSelf: "stretch", gap: 10 },
});
