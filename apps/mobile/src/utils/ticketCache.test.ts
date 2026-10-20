import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadTicket, MAX_TICKETS, saveTicket, TICKET_TTL_MS, type TicketSnapshot } from "./ticketCache";
import { OFFLINE_PREFIX, readJson } from "./offlineCache";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const NOW = new Date(2026, 9, 4, 12, 0).getTime();
const at = (ms: number) => new Date(ms).toISOString();

function snapshot(id: string, over: Partial<TicketSnapshot> = {}): TicketSnapshot {
  return {
    v: 1,
    userId: "u1",
    savedAt: at(NOW),
    order: { id, userId: "u1", offerId: "o1", businessId: "b1", quantity: 1, totalPrice: 24000, platformFee: 0, status: "CONFIRMED", pickupCode: "482931", createdAt: at(NOW) } as never,
    qrCodeDataUrl: "data:image/png;base64,AAA",
    offer: { id: "o1", title: "Набор десертов дня", pickupStart: at(NOW), pickupEnd: at(NOW + 2 * 3600_000) },
    venue: { id: "b1", name: "Кафе Пушкинъ", address: "Невский, 40", lat: 59.9, lng: 30.3 },
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("ticketCache", () => {
  it("saves the ticket and gives back the same code, QR, offer and venue", async () => {
    await saveTicket(snapshot("ord-1"), NOW);
    const loaded = await loadTicket("ord-1", "u1");
    expect(loaded?.order.pickupCode).toBe("482931");
    expect(loaded?.qrCodeDataUrl).toBe("data:image/png;base64,AAA");
    expect(loaded?.offer?.title).toBe("Набор десертов дня");
    expect(loaded?.venue?.name).toBe("Кафе Пушкинъ");
  });

  it("never shows one user's ticket to another account on the same device", async () => {
    await saveTicket(snapshot("ord-1"), NOW);
    expect(await loadTicket("ord-1", "u2")).toBeNull();
    expect(await loadTicket("ord-1", null)).toBeNull();
    expect(await loadTicket("ord-1", undefined)).toBeNull();
  });

  it("ignores a copy in an unknown format or one whose order id does not match its key", async () => {
    await AsyncStorage.setItem(`${OFFLINE_PREFIX}ticket.ord-1`, JSON.stringify({ ...snapshot("ord-1"), v: 2 }));
    expect(await loadTicket("ord-1", "u1")).toBeNull();
    await AsyncStorage.setItem(`${OFFLINE_PREFIX}ticket.ord-2`, JSON.stringify(snapshot("ord-other")));
    expect(await loadTicket("ord-2", "u1")).toBeNull();
  });

  it("a later partial save updates the order but does not erase the QR, offer or venue already saved", async () => {
    await saveTicket(snapshot("ord-1"), NOW);
    await saveTicket(snapshot("ord-1", { qrCodeDataUrl: null, offer: null, venue: null, order: { ...(snapshot("ord-1").order as object), status: "COMPLETED" } as never }), NOW);
    const loaded = await loadTicket("ord-1", "u1");
    expect(loaded?.order.status).toBe("COMPLETED");
    expect(loaded?.qrCodeDataUrl).toBe("data:image/png;base64,AAA");
    expect(loaded?.offer?.title).toBe("Набор десертов дня");
    expect(loaded?.venue?.name).toBe("Кафе Пушкинъ");
  });

  it("does not mix data across users when merging", async () => {
    await saveTicket(snapshot("ord-1"), NOW);
    await saveTicket(snapshot("ord-1", { userId: "u2", qrCodeDataUrl: null }), NOW);
    expect((await loadTicket("ord-1", "u2"))?.qrCodeDataUrl).toBeNull();
  });

  it("drops tickets once their pickup window ended more than the retention period ago", async () => {
    const old = snapshot("ord-old", { offer: { id: "o0", title: "Старый", pickupStart: at(NOW - 6 * 24 * 3600_000), pickupEnd: at(NOW - TICKET_TTL_MS - 3600_000) } });
    await saveTicket(old, NOW - 10 * 24 * 3600_000);
    await saveTicket(snapshot("ord-new"), NOW);
    expect(await loadTicket("ord-old", "u1")).toBeNull();
    expect(await loadTicket("ord-new", "u1")).not.toBeNull();
  });

  it("keeps a recently finished ticket for history", async () => {
    await saveTicket(snapshot("ord-recent", { offer: { id: "o1", title: "Вчера", pickupStart: at(NOW - 26 * 3600_000), pickupEnd: at(NOW - 24 * 3600_000) } }), NOW);
    await saveTicket(snapshot("ord-new"), NOW);
    expect(await loadTicket("ord-recent", "u1")).not.toBeNull();
  });

  it("caps the number of stored tickets and evicts the oldest", async () => {
    for (let i = 0; i < MAX_TICKETS + 3; i++) await saveTicket(snapshot(`ord-${i}`), NOW + i);
    expect(await loadTicket("ord-0", "u1")).toBeNull();
    expect(await loadTicket("ord-2", "u1")).toBeNull();
    expect(await loadTicket(`ord-${MAX_TICKETS + 2}`, "u1")).not.toBeNull();
    const index = await readJson<unknown[]>("tickets");
    expect(index).toHaveLength(MAX_TICKETS);
  });

  it("saving the same order again moves it to the front instead of duplicating it", async () => {
    await saveTicket(snapshot("a"), NOW);
    await saveTicket(snapshot("b"), NOW);
    await saveTicket(snapshot("a"), NOW);
    const index = await readJson<{ id: string }[]>("tickets");
    expect(index?.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("parallel saves of different tickets (payment + orders tab) both end up in the index", async () => {
    await Promise.all([saveTicket(snapshot("a"), NOW), saveTicket(snapshot("b"), NOW), saveTicket(snapshot("c"), NOW)]);
    const index = await readJson<{ id: string }[]>("tickets");
    expect(index?.map((entry) => entry.id).sort()).toEqual(["a", "b", "c"]);
  });
});
