import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { playHaptic } from "../utils/haptics";
import { DockIcon, type DockIconName } from "./icons/DockIcons";
import type { MainTabParamList } from "../navigation/types";

const ICONS: Record<keyof MainTabParamList, DockIconName> = {
  Home: "now",
  Map: "map",
  Orders: "orders",
  EcoProfile: "eco",
  Profile: "profile",
};

const LAMP_WIDTH = 28;

/**
 * Нижняя навигация как "док": отдельная плавающая капсула над контентом вместо ленты с
 * эмодзи. Активную вкладку показывает светящийся "фитиль" на верхней кромке — он не
 * перепрыгивает, а скользит к выбранной иконке пружиной, как горящая искра по шнуру.
 * Док стоит в потоке (не перекрывает экраны), поэтому раскладка страниц не меняется.
 */
export function TabDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const itemWidth = width / state.routes.length;
  const lamp = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(lamp, { toValue: state.index, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
  }, [state.index, lamp]);

  const translateX = lamp.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: state.routes.map((_, index) => index * itemWidth + (itemWidth - LAMP_WIDTH) / 2),
  });

  const dark = theme.mode === "dark";
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={[styles.outer, { backgroundColor: theme.colors.background, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View
        onLayout={onLayout}
        accessibilityRole="tablist"
        style={[
          styles.dock,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderColor: theme.colors.border,
            boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.55)" : "0 10px 26px rgba(22,32,30,0.10)",
          },
        ]}
      >
        <Animated.View
          style={[
            styles.lamp,
            { backgroundColor: theme.colors.primary, boxShadow: `0 0 14px ${theme.colors.primary}`, transform: [{ translateX }] },
          ]}
        />
        {state.routes.map((route, index) => (
          <DockItem
            key={route.key}
            focused={state.index === index}
            label={descriptors[route.key].options.title ?? route.name}
            icon={ICONS[route.name as keyof MainTabParamList]}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (state.index !== index && !event.defaultPrevented) {
                playHaptic("select");
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
          />
        ))}
      </View>
    </View>
  );
}

function DockItem({
  focused,
  label,
  icon,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  icon: DockIconName;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const lift = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 10 }).start();
  }, [focused, lift]);

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const color = focused ? theme.colors.primary : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.item, { cursor: "pointer" }]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <DockIcon name={icon} size={25} color={color} dot={theme.colors.ember} active={focused} />
      </Animated.View>
      <Text style={[styles.label, { color: focused ? theme.colors.text : theme.colors.textMuted, fontWeight: focused ? "800" : "600" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 12, paddingTop: 6, alignItems: "center" },
  // На широком экране док не растягивается на всю ширину: табы иначе разъезжаются на 1400px.
  dock: { flexDirection: "row", height: 64, width: "100%", maxWidth: 460, borderRadius: 24, borderWidth: 1, alignItems: "center", paddingHorizontal: 2 },
  lamp: { position: "absolute", top: -1.5, left: 2, width: LAMP_WIDTH, height: 3, borderRadius: 2 },
  item: { flex: 1, height: 64, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 10.5, letterSpacing: 0.2 },
});
