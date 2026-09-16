import React from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { EmptyView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"EcoProfile">;

/** Заглушка каркаса (ШАГ 7). Баллы, уровни, спасённые кг — реальный сценарий ШАГ 8. */
export function EcoProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
        {t("eco.title")}
      </Text>
      <EmptyView label={t("common.comingInStep8")} />
    </Screen>
  );
}
