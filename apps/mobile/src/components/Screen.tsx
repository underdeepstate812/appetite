import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
}

export function Screen({ children, scroll = false }: ScreenProps) {
  const theme = useTheme();
  const safeStyle = [styles.safe, { backgroundColor: theme.colors.background }];
  const padding = { padding: theme.spacing.md };

  if (scroll) {
    return (
      <SafeAreaView style={safeStyle}>
        <ScrollView contentContainerStyle={[styles.grow, padding]}>{children}</ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={safeStyle}>
      <View style={[styles.grow, padding]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // flexGrow:1 в RN компилируется в CSS "flex: 1 0 auto" — flexShrink по
  // умолчанию 0 (в отличие от веб-CSS, где по умолчанию 1), так что контейнер
  // мог расти, но не мог сжаться меньше высоты своего контента. Явный
  // flexShrink:1 + minHeight:0 — вместе они действительно дают контейнеру
  // сжаться до остатка высоты экрана, иначе вложенный ScrollView (HomeScreen)
  // не получает ограниченную высоту и не может скроллиться сам по себе —
  // контент за пределами первого экрана был недостижим.
  grow: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
});
