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
  grow: { flexGrow: 1 },
});
