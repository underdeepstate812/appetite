import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { passBars, passSerial } from "../../utils/pass";

const HEIGHT = 26;

/**
 * Подвязка корешка: номер пропуска и штрих-код. Оба выводятся из id пользователя, поэтому рисунок — именно этого
 * пропуска, а не картинка-заполнитель. Чисто декоративный знак принадлежности: скринридеру достаточно номера.
 */
export function PassFooter({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const serial = passSerial(userId);
  const bars = useMemo(() => passBars(userId), [userId]);
  let x = 0;
  const rects = bars.map((w, i) => {
    const rect = { x, w, i };
    x += w + 1.6;
    return rect;
  });
  const width = x;

  return (
    <View style={styles.row}>
      <Text style={[styles.serial, { color: theme.colors.textMuted }]}>{t("profile.passNo", { serial })}</Text>
      <View style={styles.code} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...({ "aria-hidden": true } as object)}>
        <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          {rects.map(({ x: rx, w, i }) => (
            <Rect key={i} x={rx} y={0} width={w} height={HEIGHT} fill={theme.colors.textMuted} fillOpacity={0.55} />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 6 },
  serial: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, fontVariant: ["tabular-nums"] },
  code: { opacity: 0.9 },
});
