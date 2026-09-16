import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { CardIcon, FastPaymentIcon } from "./icons/PaymentIcons";

export type PaymentMethod = "card" | "sbp";

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  cardLabel: string;
  sbpLabel: string;
  cardHint: string;
  sbpHint: string;
}

/**
 * Оплата в бете всегда mock (backend PaymentProvider) — выбор способа не меняет
 * поведение сервера, но делает экран оформления честным и привычным: пользователь
 * видит реальный выбор (карта/СБП), а не один безальтернативный "Оплатить".
 */
export function PaymentMethodSelector({ value, onChange, cardLabel, sbpLabel, cardHint, sbpHint }: PaymentMethodSelectorProps) {
  const theme = useTheme();

  const options: { key: PaymentMethod; label: string; hint: string; Icon: typeof CardIcon }[] = [
    { key: "card", label: cardLabel, hint: cardHint, Icon: CardIcon },
    { key: "sbp", label: sbpLabel, hint: sbpHint, Icon: FastPaymentIcon },
  ];

  return (
    <View style={styles.stack}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.row,
              {
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceElevated }]}>
              <option.Icon size={20} color={selected ? theme.colors.primary : theme.colors.textMuted} />
            </View>
            <View style={styles.labelWrap}>
              <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>{option.label}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 1 }]}>
                {option.hint}
              </Text>
            </View>
            <View
              style={[
                styles.radio,
                { borderColor: selected ? theme.colors.primary : theme.colors.border },
                selected && { backgroundColor: theme.colors.primary },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1.5, minHeight: 60 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  labelWrap: { flex: 1, marginLeft: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
});
