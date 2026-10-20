import React, { forwardRef, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TextInput, TextInputProps, View, type StyleProp, type ViewStyle } from "react-native";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Пояснение под полем (скрывается, пока показана ошибка). */
  hint?: string;
  /** Элемент справа внутри поля — например, «показать пароль». */
  rightAccessory?: React.ReactNode;
  /** Стиль внешнего контейнера (отступы между полями). */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Поле ввода — «вдавленная лунка» без рамки (тот же язык, что у вторичной кнопки), а состояние фокуса
 * показывает «фитиль»: тонкая линия по нижней кромке разгорается слева направо (цвет бренда),
 * при ошибке горит красным целиком. Подпись всегда над полем (не плейсхолдер): её видно во время ввода.
 * Шрифт 16 px — на iOS меньший размер заставляет браузер приближать страницу при фокусе.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, rightAccessory, containerStyle, style, onFocus, onBlur, ...rest },
  ref
) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const dark = theme.mode === "dark";
  const [focused, setFocused] = useState(false);
  const fuse = useRef(new Animated.Value(0)).current;

  const lit = focused || !!error;
  useEffect(() => {
    if (reduced) {
      fuse.setValue(lit ? 1 : 0);
      return;
    }
    Animated.timing(fuse, { toValue: lit ? 1 : 0, duration: lit ? 260 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [lit, reduced, fuse]);

  const fuseColor = error ? theme.colors.danger : theme.colors.primary;
  const fuseWidth = fuse.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={[styles.label, { color: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.well,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.md,
            boxShadow: dark
              ? "inset 0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.05)"
              : "inset 0 2px 4px rgba(26,22,15,0.10), inset 0 -1px 0 rgba(255,255,255,0.8)",
          },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          aria-invalid={error ? true : undefined}
          // Плейсхолдер заметно бледнее введённого текста: иначе подсказка «name@mail.ru» читается как уже введённое значение.
          placeholderTextColor={`${theme.colors.textMuted}80`}
          selectionColor={theme.colors.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: theme.colors.text }, rightAccessory ? styles.inputWithAccessory : null, style]}
          {...rest}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
        <View pointerEvents="none" style={styles.fuseTrack}>
          <Animated.View style={[styles.fuse, { width: fuseWidth, backgroundColor: fuseColor }]} />
        </View>
      </View>
      {error ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <CircleAlert size={14} color={theme.colors.danger} strokeWidth={2.4} />
          <Text accessibilityRole="alert" style={[styles.message, { color: theme.colors.danger }]}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text style={[styles.message, styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginLeft: 2 },
  well: { minHeight: 52, justifyContent: "center", overflow: "hidden" },
  // outlineStyle: "none" — браузерное кольцо фокуса заменено собственным «фитилём».
  input: { paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, outlineStyle: "none" } as object,
  inputWithAccessory: { paddingRight: 52 },
  accessory: { position: "absolute", right: 4, top: 0, bottom: 0, justifyContent: "center" },
  fuseTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2.5 },
  fuse: { height: 2.5, borderRadius: 2 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, marginLeft: 2 },
  message: { fontSize: 12.5, flexShrink: 1 },
  hint: { marginTop: 6, marginLeft: 2 },
});
