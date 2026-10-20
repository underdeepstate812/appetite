/**
 * Префикс подписи карты (левая часть «Leaflet | © OpenStreetMap»). По умолчанию Leaflet 1.9 ставит в него
 * флаг Украины — здесь заменён на флаг РФ; ссылка на Leaflet сохранена (его лицензия требует указания авторства).
 */
export const LEAFLET_ATTRIBUTION_PREFIX =
  `<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">` +
  `<svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" style="vertical-align:baseline;margin-right:4px;border:1px solid rgba(0,0,0,.25)">` +
  `<rect width="12" height="8" fill="#fff"/><rect y="2.67" width="12" height="2.67" fill="#0039a6"/><rect y="5.33" width="12" height="2.67" fill="#d52b1e"/>` +
  `</svg>Leaflet</a>`;
