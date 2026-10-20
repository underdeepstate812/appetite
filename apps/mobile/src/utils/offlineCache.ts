import AsyncStorage from "@react-native-async-storage/async-storage";

/** Все офлайн-данные живут под одним префиксом — чтобы при выходе из аккаунта стереть их разом и не задеть настройки (тема, язык). */
export const OFFLINE_PREFIX = "apetite.offline.";

/** Кэш — best-effort: недоступное хранилище (приватный режим, переполнение) не должно ломать экран, просто работаем без кэша. */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Битый JSON — тоже «нет кэша»: не оставляем его, чтобы не спотыкаться при каждом открытии.
    void AsyncStorage.removeItem(OFFLINE_PREFIX + key).catch(() => {});
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_PREFIX + key, JSON.stringify(value));
  } catch {
    // см. выше: кэш не обязан сохраняться
  }
}

export async function removeKeys(keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => AsyncStorage.removeItem(OFFLINE_PREFIX + key)));
  } catch {
    // best-effort
  }
}

/**
 * Записи кэша — это «прочитал → изменил → записал» (индекс билетов, список заказов). Две параллельные такие операции
 * (оплата сохраняет билет, пока вкладка «Заказы» сохраняет список) затирали бы друг друга; очередь исполняет их строго по одной.
 * Очистка при выходе идёт через ту же очередь: запись, начатая до выхода, не «воскреснет» после него.
 */
let queue: Promise<unknown> = Promise.resolve();
export function withCacheLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Выход из аккаунта: билеты и список заказов принадлежат пользователю, на устройстве они оставаться не должны. */
export function clearOfflineData(): Promise<void> {
  return withCacheLock(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const own = keys.filter((key) => key.startsWith(OFFLINE_PREFIX));
      if (own.length > 0) await AsyncStorage.multiRemove(own);
    } catch {
      // best-effort
    }
  });
}
