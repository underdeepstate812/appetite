import React from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { EmptyView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

/** Заглушка каркаса (ШАГ 7). Оплата (mock) + QR-подтверждение — реальный сценарий ШАГ 8. */
export function CheckoutScreen({ route }: RootStackScreenProps<"Checkout">) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
        {t("checkout.title")}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.md }}>
        offerId: {route.params.offerId}
      </Text>
      <EmptyView label={t("common.comingInStep8")} />
    </Screen>
  );
}
