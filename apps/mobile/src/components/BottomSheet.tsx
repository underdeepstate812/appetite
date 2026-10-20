import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { glassTokens } from "../theme/glass";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { dragOffset, shouldDismissSheet } from "../utils/sheet";
import { playHaptic } from "../utils/haptics";

const SHEET_OFFSET = 520;
const frosted = Platform.OS === "web" ? ({ backdropFilter: "blur(20px) saturate(1.3)" } as ViewStyle) : null;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Подпись для затемнения: оно же — кнопка «закрыть» для скринридера. */
  closeLabel: string;
  /** Закрытие свайпом вниз за «ручку» (как Drawer в 21st.dev); по умолчанию включено. Кнопки «Закрыть», затемнение и Esc работают всегда. */
  swipeToDismiss?: boolean;
  children: React.ReactNode;
}

/**
 * Шторка снизу в стиле «стекло и неон»: затемнение, лист выезжает пружиной, сверху — мятная кромка и свечение вверх.
 * Модалка остаётся смонтированной, пока лист не уедет, — иначе закрытие обрывалось бы на полуанимации.
 */
export function BottomSheet({ visible, onClose, closeLabel, swipeToDismiss = true, children }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const g = glassTokens(theme.mode, "mint");

  // «Смонтирована ли модалка» держим и в ref: эффект зависит только от visible, а не от mounted — иначе после setMounted(true)
  // он срабатывал бы повторно и перезапускал анимацию появления.
  const mountedRef = useRef(visible);
  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setMounted(true);
      progress.setValue(reduced ? 1 : 0);
      if (!reduced) Animated.spring(progress, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
    } else if (mountedRef.current) {
      const unmount = () => {
        mountedRef.current = false;
        setMounted(false);
      };
      if (reduced) {
        unmount();
        return;
      }
      // finished=false — закрытие прервали повторным открытием: модалку убирать нельзя.
      Animated.timing(progress, { toValue: 0, duration: 170, useNativeDriver: true }).start(({ finished }) => finished && unmount());
    }
  }, [visible, progress, reduced]);

  // Свайп: смещение от пальца добавляется к «въезду». Затемнение светлеет по мере того, как шторку утаскивают вниз.
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 3,
        onPanResponderMove: (_, g) => drag.setValue(dragOffset(g.dy)),
        onPanResponderRelease: (_, g) => {
          if (shouldDismissSheet(g.dy, g.vy)) {
            playHaptic("tap");
            onCloseRef.current();
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start(),
      }),
    [drag]
  );
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSET, 0] }), drag);
  const backdropOpacity = Animated.multiply(progress, drag.interpolate({ inputRange: [0, 320], outputRange: [1, 0.25], extrapolate: "clamp" }));

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          // Жест «Escape» скринридера (двумя пальцами «Z» на iOS) закрывает шторку, как системную.
          onAccessibilityEscape={onClose}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.mode === "dark" ? "rgba(18, 26, 25, 0.94)" : "rgba(255, 253, 248, 0.95)",
              borderColor: g.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              boxShadow: theme.mode === "dark" ? "0 -12px 40px rgba(45, 212, 191, 0.14)" : "0 -10px 36px rgba(15, 118, 110, 0.12)",
              transform: [{ translateY }],
            },
            frosted,
          ]}
        >
          {/* Зона «ручки» — 44 px по высоте: за неё тянут шторку вниз; сам лист при этом не перехватывает прокрутку содержимого. */}
          <View testID="sheet-grab" {...(swipeToDismiss ? pan.panHandlers : {})} style={[styles.grab, swipeToDismiss && ({ cursor: "grab", touchAction: "none" } as object)]}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>
          {/* На низких экранах (320×568, альбомная ориентация) содержимое листа прокручивается, а не уходит за край. */}
          <ScrollView
            style={{ maxHeight: height * 0.88 - 60 }}
            // Поля внутри прокрутки: ScrollView обрезает всё, что выходит за его границы, — без них свечение иконки и тень кнопки упирались бы в жёсткий край.
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(4,10,9,0.62)" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  content: { padding: 8 },
  grab: { height: 30, marginTop: -10, marginBottom: 4, alignItems: "center", justifyContent: "center" },
  handle: { width: 42, height: 4, borderRadius: 2 },
});
