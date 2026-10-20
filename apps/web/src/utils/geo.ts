/** Центр Санкт-Петербурга (пилот) — точка отсчёта витрины, пока нет (или не подходит) реальная геопозиция. */
export const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };

/**
 * Дальше этого от центра города предложений нет вообще (пилот — только Санкт-Петербург, самые дальние районы —
 * в 15 км). Человек за 60 км от центра увидел бы пустую витрину, поэтому для него показываем город целиком.
 */
export const COVERAGE_KM = 60;

/** Расстояние по дуге большого круга, км (формула гаверсинусов) — для проверок «где человек», не для маршрутов. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Геопозиция человека попадает в зону, где у нас есть предложения. */
export function isInCoverage(point: { lat: number; lng: number }): boolean {
  return distanceKm(point, SPB_CENTER) <= COVERAGE_KM;
}
