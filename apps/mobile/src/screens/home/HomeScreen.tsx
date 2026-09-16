import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Home">;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await offersApi.list({ status: "ACTIVE", pageSize: 50 });
      setOffers(page.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.error"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (offers === null && !error) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
        {t("home.title")}
      </Text>
      {error ? (
        <ErrorView label={error} />
      ) : (
        <FlatList
          data={offers ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={<EmptyView label={t("home.empty")} />}
          contentContainerStyle={offers && offers.length === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("OfferDetail", { offerId: item.id })}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.md,
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.cardRow}>
                <Text style={[theme.typography.bodyBold, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={[styles.badge, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.full }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>
                    {t("home.discount", { percent: item.discountPercent })}
                  </Text>
                </View>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                {t("home.priceFrom", { price: (item.discountedPrice / 100).toFixed(0) })}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  grow: { flexGrow: 1 },
});
