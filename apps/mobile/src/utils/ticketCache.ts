import type { Business, Offer, Order } from "@apetite/shared";
import { readJson, removeKeys, withCacheLock, writeJson } from "./offlineCache";

/**
 * Сохранённый билет: код самовывоза и QR остаются доступны там, где связи нет — а именно у кассы, в подвале торгового центра.
 *
 * Что здесь лежит и почему это допустимо: код самовывоза (6 цифр, он же закодирован в QR) действует только до конца окна
 * выдачи и только при личном предъявлении в заведении; на экране приложения он виден и так. Хранится в AsyncStorage,
 * а не в SecureStore: у того лимит значения ≈2 КБ, а картинка QR крупнее. Привязан к пользователю, стирается при выходе
 * из аккаунта и устаревает через TICKET_TTL_MS после окончания окна выдачи.
 */
export type TicketOffer = Pick<Offer, "id" | "title" | "pickupStart" | "pickupEnd">;
export type TicketVenue = Pick<Business, "id" | "name" | "address" | "lat" | "lng">;

export interface TicketSnapshot {
  v: 1;
  userId: string;
  /** Когда копия сделана (ISO) — показываем в плашке «нет сети». */
  savedAt: string;
  order: Order;
  qrCodeDataUrl: string | null;
  offer: TicketOffer | null;
  venue: TicketVenue | null;
}

interface TicketIndexEntry {
  id: string;
  savedAt: string;
}

const INDEX_KEY = "tickets";
const ticketKey = (orderId: string) => `ticket.${orderId}`;
export const MAX_TICKETS = 20;
/** Сколько хранить билет после конца окна выдачи: чтобы история не пропала сразу, но и мусор не копился. */
export const TICKET_TTL_MS = 3 * 24 * 3600_000;

/** Свежие данные побеждают, но пропуски не стирают уже сохранённое (QR не должен исчезнуть из-за неудачного запроса заведения). */
function merge(prev: TicketSnapshot | null, next: TicketSnapshot): TicketSnapshot {
  if (!prev || prev.userId !== next.userId) return next;
  return {
    ...next,
    qrCodeDataUrl: next.qrCodeDataUrl ?? prev.qrCodeDataUrl,
    offer: next.offer ?? prev.offer,
    venue: next.venue ?? prev.venue,
  };
}

export async function loadTicket(orderId: string, userId: string | null | undefined): Promise<TicketSnapshot | null> {
  if (!userId) return null;
  const snapshot = await readJson<TicketSnapshot>(ticketKey(orderId));
  // Чужой билет (на устройстве сменили аккаунт) или неизвестная версия формата — как будто кэша нет.
  if (!snapshot || snapshot.v !== 1 || snapshot.userId !== userId || snapshot.order?.id !== orderId) return null;
  return snapshot;
}

export function saveTicket(snapshot: TicketSnapshot, now: number = Date.now()): Promise<void> {
  return withCacheLock(() => writeTicket(snapshot, now));
}

async function writeTicket(snapshot: TicketSnapshot, now: number): Promise<void> {
  const prev = await readJson<TicketSnapshot>(ticketKey(snapshot.order.id));
  await writeJson(ticketKey(snapshot.order.id), merge(prev, snapshot));

  const index = (await readJson<TicketIndexEntry[]>(INDEX_KEY)) ?? [];
  const entries = [{ id: snapshot.order.id, savedAt: snapshot.savedAt }, ...index.filter((entry) => entry.id !== snapshot.order.id)];
  await pruneTickets(entries, now);
}

async function pruneTickets(entries: TicketIndexEntry[], now: number): Promise<void> {
  const keep: TicketIndexEntry[] = [];
  const drop: string[] = [];
  for (const entry of entries) {
    const snapshot = keep.length < MAX_TICKETS ? await readJson<TicketSnapshot>(ticketKey(entry.id)) : null;
    const end = snapshot?.offer ? new Date(snapshot.offer.pickupEnd).getTime() : Number.NaN;
    const expired = Number.isFinite(end) && end + TICKET_TTL_MS < now;
    if (!snapshot || expired) drop.push(ticketKey(entry.id));
    else keep.push(entry);
  }
  await removeKeys(drop);
  await writeJson(INDEX_KEY, keep);
}
