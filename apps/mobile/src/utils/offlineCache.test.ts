import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearOfflineData, OFFLINE_PREFIX, readJson, removeKeys, withCacheLock, writeJson } from "./offlineCache";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Мок AsyncStorage целиком состоит из jest.fn: отказы задаём одноразовыми (…Once), чтобы не ломать реализацию для следующих тестов.
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("offlineCache", () => {
  it("round-trips JSON under its own prefix", async () => {
    await writeJson("x", { a: 1 });
    expect(await readJson("x")).toEqual({ a: 1 });
    expect(await AsyncStorage.getItem(`${OFFLINE_PREFIX}x`)).toBe('{"a":1}');
  });

  it("returns null for a missing key", async () => {
    expect(await readJson("nope")).toBeNull();
  });

  it("treats corrupt data as 'no cache' and removes it so it does not trip every open", async () => {
    await AsyncStorage.setItem(`${OFFLINE_PREFIX}bad`, "{not json");
    expect(await readJson("bad")).toBeNull();
    await Promise.resolve();
    expect(await AsyncStorage.getItem(`${OFFLINE_PREFIX}bad`)).toBeNull();
  });

  it("never throws when storage fails: the cache is best-effort", async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("quota"));
    await expect(writeJson("x", 1)).resolves.toBeUndefined();
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("io"));
    await expect(readJson("x")).resolves.toBeNull();
  });

  it("removes only the keys asked for", async () => {
    await writeJson("a", 1);
    await writeJson("b", 2);
    await removeKeys(["a"]);
    expect(await readJson("a")).toBeNull();
    expect(await readJson("b")).toBe(2);
  });

  it("clears every offline entry on logout but leaves unrelated settings alone", async () => {
    await writeJson("ticket.1", 1);
    await writeJson("orders", 2);
    await AsyncStorage.setItem("apetite.theme", "dark");
    await AsyncStorage.setItem("apetite.language", "ru");

    await clearOfflineData();

    expect(await readJson("ticket.1")).toBeNull();
    expect(await readJson("orders")).toBeNull();
    expect(await AsyncStorage.getItem("apetite.theme")).toBe("dark");
    expect(await AsyncStorage.getItem("apetite.language")).toBe("ru");
  });

  it("does not throw when clearing fails", async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValueOnce(new Error("io"));
    await expect(clearOfflineData()).resolves.toBeUndefined();
  });
});

describe("withCacheLock", () => {
  it("runs read-modify-write tasks one at a time, so parallel saves do not overwrite each other", async () => {
    await writeJson("counter", 0);
    const bump = () =>
      withCacheLock(async () => {
        const current = (await readJson<number>("counter")) ?? 0;
        await new Promise((resolve) => setTimeout(resolve, 5));
        await writeJson("counter", current + 1);
      });
    await Promise.all([bump(), bump(), bump(), bump()]);
    expect(await readJson("counter")).toBe(4);
  });

  it("keeps working after a task fails", async () => {
    await expect(withCacheLock(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(withCacheLock(async () => 7)).resolves.toBe(7);
  });

  it("a save started before logout cannot bring data back after it", async () => {
    const save = withCacheLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await writeJson("ticket.1", { id: 1 });
    });
    const clear = clearOfflineData();
    await Promise.all([save, clear]);
    expect(await readJson("ticket.1")).toBeNull();
  });
});
