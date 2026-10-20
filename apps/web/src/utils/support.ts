/** Единственный канал поддержки, который есть в продукте сейчас (тот же адрес — в подвале сайта и в оферте). */
export const SUPPORT_EMAIL = "hello@apetite.ru";

export type SupportReason = "general" | "payment" | "app" | "other";

export const SUPPORT_REASONS: { value: SupportReason; label: string }[] = [
  { value: "general", label: "Вопрос по сервису" },
  { value: "payment", label: "Оплата" },
  { value: "app", label: "Сайт или приложение работает не так" },
  { value: "other", label: "Другое" },
];

/** mailto: через encodeURIComponent (пробел — %20): в mailto «+» не пробел, и почтовый клиент показал бы его буквально. */
export function buildMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Письмо в поддержку из профиля: тема выбрана, аккаунт указан — переспрашивать не придётся. */
export function buildSupportMailto(reason: SupportReason, user: { id: string; name: string; email?: string | null }): string {
  const label = SUPPORT_REASONS.find((item) => item.value === reason)?.label ?? "Вопрос";
  const subject = `Appetite: ${label}`;
  const body = `Здравствуйте!\n\n\n\n—\nАккаунт: ${user.name}${user.email ? ` (${user.email})` : ""}\nID: ${user.id}\nСайт appetite`;
  return buildMailto(SUPPORT_EMAIL, subject, body);
}
