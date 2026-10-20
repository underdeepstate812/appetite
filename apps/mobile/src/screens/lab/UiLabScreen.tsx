import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Receipt from "lucide-react-native/icons/receipt-text";
import Moon from "lucide-react-native/icons/moon";
import Sun from "lucide-react-native/icons/sun";
import { OrderStatus } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import { useThemeModeStore, type ThemeModeOverride } from "../../store/themeStore";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { BottomSheet } from "../../components/BottomSheet";
import { PaymentMethodSelector, type PaymentMethod } from "../../components/PaymentMethodSelector";
import { GlassCard } from "../../components/glass/GlassCard";
import { GlassSegmented } from "../../components/kit/GlassSegmented";
import { RadioCards } from "../../components/kit/RadioCards";
import { EmptyState, OfflineState } from "../../components/kit/EmptyState";
import { StatusBadge } from "../../components/kit/StatusBadge";
import { OrdersListSkeleton } from "../../components/kit/Skeleton";

type TimeTab = "now" | "evening" | "all";
const STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.EXPIRED];

/** Заголовок раздела галереи. Вынесен из экрана: компонент, объявленный внутри render, пересоздаётся на каждое нажатие и сбрасывает анимации. */
function Section({ title, idea, children }: { title: string; idea: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[theme.typography.h2, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.idea, { color: theme.colors.textMuted }]}>{idea}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/**
 * Галерея элементов интерфейса (только dev-сборка, адрес /ui-lab): решения из 21st.dev в палитре Ember — те, что уже
 * подключены в приложении. Нужна, чтобы смотреть и проверять элементы отдельно от экранов и данных.
 */
export function UiLabScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "mint").accent;
  const setOverride = useThemeModeStore((state) => state.setOverride);

  const [tab, setTab] = useState<TimeTab>("now");
  const [pay, setPay] = useState<PaymentMethod>("card");
  const [topic, setTopic] = useState("pickup");
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);

  const tabs = [
    { value: "now" as const, label: "Сейчас" },
    { value: "evening" as const, label: "Вечерние" },
    { value: "all" as const, label: "Все" },
  ];

  return (
    <Screen scroll ambient>
      <Text style={[theme.fonts.bold, styles.kicker, { color: accent }]}>UI LAB · ГАЛЕРЕЯ ЭЛЕМЕНТОВ</Text>
      <Text accessibilityRole="header" style={[theme.typography.h1, { color: theme.colors.text }]}>
        Элементы интерфейса
      </Text>
      <Text style={[styles.lead, { color: theme.colors.textMuted }]}>Решения из 21st.dev в нашей палитре. Всё нажимается. Только dev-сборка.</Text>
      <View style={styles.themeRow}>
        <Text style={[styles.themeLabel, { color: theme.colors.textMuted }]}>Тема</Text>
        <GlassSegmented
          compact
          accessibilityLabel="Тема оформления"
          options={[
            { value: "light", label: "Светлая", icon: (color) => <Sun size={19} color={color} strokeWidth={2.2} /> },
            { value: "dark", label: "Тёмная", icon: (color) => <Moon size={19} color={color} strokeWidth={2.2} /> },
          ]}
          value={theme.mode}
          onChange={(mode) => void setOverride(mode as ThemeModeOverride)}
        />
      </View>

      <Section title="Сегментный переключатель" idea="LiquidRadio: под выбранным сегментом переезжает капля стекла с подсвеченной кромкой. Главная и «Уведомления».">
        <GlassSegmented accessibilityLabel="Время самовывоза" options={tabs} value={tab} onChange={setTab} />
      </Section>

      <Section title="Способ оплаты" idea="Icon Card Radio Group + LiquidRadio: одна стеклянная плашка скользит между карточками, отметка выскакивает пружиной.">
        <PaymentMethodSelector value={pay} onChange={setPay} cardLabel="Банковская карта" cardHint="Visa, Mastercard, МИР" sbpLabel="СБП" sbpHint="Оплата по QR через банк" groupLabel="Способ оплаты" />
      </Section>

      <Section title="Статус заказа" idea="Status Badge: тонированная плашка с точкой; у активного заказа точка «дышит» — его сразу видно в списке.">
        <View style={styles.statusCol}>
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} label={t(`orders.status.${s}`)} />
          ))}
        </View>
      </Section>

      <Section title="Пустые и офлайн-состояния" idea="Empty и Offline Empty State: значок в стеклянном ореоле, заголовок, пояснение, одно действие.">
        <GlassCard tone="mint" glow={false} style={styles.emptyCard}>
          <EmptyState
            icon={(c) => <Receipt size={30} color={c} strokeWidth={2.1} />}
            title={t("states.ordersEmptyTitle")}
            description={t("states.ordersEmptyHint")}
            action={{ label: t("states.ordersEmptyCta"), onPress: () => {} }}
          />
        </GlassCard>
        <GlassCard tone="ember" glow={false} style={styles.emptyCard}>
          <OfflineState onRetry={() => {}} />
        </GlassCard>
      </Section>

      <Section title="Загрузка списка" idea="Skeleton: заглушки повторяют раскладку строки заказа, по ним бежит общий блик.">
        <View style={styles.skeletonBox}>{loading ? <OrdersListSkeleton count={3} label={t("common.loading")} /> : <Text style={{ color: theme.colors.textMuted }}>Загрузка закончилась</Text>}</View>
        <Button title={loading ? "Показать, что загрузилось" : "Снова показать загрузку"} variant="secondary" size="sm" onPress={() => setLoading((v) => !v)} />
      </Section>

      <Section title="Шторка со свайпом" idea="Drawer: шторку можно утащить вниз за «ручку» (дальше 110 px или быстрым щелчком — закроется, иначе вернётся).">
        <Button title="Открыть шторку" onPress={() => setSheet(true)} arrow />
      </Section>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} closeLabel="Закрыть">
        <Text accessibilityRole="header" style={[theme.typography.h2, { color: theme.colors.text }]}>
          Потяните за «ручку» вниз
        </Text>
        <Text style={[styles.idea, { color: theme.colors.textMuted, marginBottom: 14 }]}>Тема обращения — те же радио-карточки со скользящей плашкой.</Text>
        <RadioCards
          groupLabel="Тема обращения"
          value={topic}
          onChange={setTopic}
          options={[
            { value: "pickup", label: "Не могу забрать заказ" },
            { value: "closed", label: "Заведение закрыто или нет товара" },
            { value: "amount", label: "Списана не та сумма" },
            { value: "other", label: "Другое" },
          ]}
        />
        <View style={{ marginTop: 16 }}>
          <Button title="Закрыть" variant="ghost" onPress={() => setSheet(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, letterSpacing: 1.2, marginTop: 8 },
  lead: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  themeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  themeLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  section: { marginTop: 32 },
  idea: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  body: { marginTop: 14, gap: 12 },
  statusCol: { gap: 12, alignItems: "flex-start" },
  emptyCard: { padding: 4 },
  skeletonBox: { minHeight: 210 },
});
