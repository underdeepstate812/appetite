/**
 * Праздник (вспышка оплаты, "печать" билета) играется один раз на заказ: если экран
 * пересоздан (возврат из фона, повторный заход по пушу), повторный салют раздражает.
 * Хранится в памяти процесса — после перезапуска приложения заказ снова можно "открыть" спокойно.
 */
const celebrated = new Set<string>();

export function hasCelebrated(orderId: string): boolean {
  return celebrated.has(orderId);
}

export function markCelebrated(orderId: string): void {
  celebrated.add(orderId);
}
