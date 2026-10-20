import { useState } from "react";
import { LocateFixed, MapPinned, RotateCw, X } from "lucide-react";
import type { GeoStatus } from "../hooks/useGeolocation";

/** Порядок витрины: ближайшие к человеку или горящие первыми. «Ближайшие» осмысленны только с определённой позицией. */
export type FeedSort = "near" | "hot";

export interface GeoState {
  status: GeoStatus;
  /** Витрина собрана вокруг человека: позиция известна и он в зоне, где есть предложения. */
  located: boolean;
  /** Позиция известна, но человек за пределами Санкт-Петербурга — показываем город целиком. */
  outside: boolean;
}

export function geoMessage({ status, located, outside }: GeoState, sort: FeedSort): string {
  if (status === "locating") return "Определяем, где вы…";
  if (outside) return "Вы за пределами Санкт-Петербурга — показываем весь город";
  if (located) return sort === "near" ? "Рядом с вами · ближайшие первыми" : "Рядом с вами · горящие первыми";
  switch (status) {
    case "denied":
      return "Доступ к геолокации заблокирован в браузере";
    case "timeout":
      return "Не удалось определить местоположение вовремя";
    case "unavailable":
      return "Не удалось определить местоположение";
    case "insecure":
      return "Геолокация работает только по защищённому соединению (HTTPS)";
    default:
      return "Весь Санкт-Петербург";
  }
}

const isIos = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

/** Что делать, если доступ заблокирован: повторный запрос браузер уже не покажет, включать надо в настройках сайта. */
function DeniedHelp() {
  return (
    <div className="geo-help" id="geo-help">
      <p>Браузер запомнил отказ и больше не спрашивает. Разрешите «Геопозицию» для этого сайта:</p>
      <ul>
        <li>Chrome, Firefox, Edge — значок замка слева от адреса → «Разрешения» → «Геопозиция» → «Разрешить».</li>
        <li>{isIos() ? "iPhone: значок «aA» в адресной строке → «Настройки веб-сайта» → «Геопозиция» → «Разрешить»; если не помогло — «Настройки» → «Конфиденциальность» → «Службы геолокации» → Safari." : "Safari — «Настройки» → «Веб-сайты» → «Геопозиция» → «Разрешить» для этого сайта."}</li>
      </ul>
      <p>Открыли ссылку в Telegram, Instagram или другом приложении? Откройте её в Safari или Chrome: во встроенном браузере геолокация обычно выключена.</p>
      <p>Как только разрешите, витрина подхватит позицию сама, а если нет — нажмите «Повторить».</p>
    </div>
  );
}

interface GeoStatusLineProps {
  geo: GeoState;
  sort: FeedSort;
  onSort: (sort: FeedSort) => void;
  onLocate: () => void;
  onReset: () => void;
  /** Приглашение «Показать ближайшие первыми?» уже на экране и несёт ту же кнопку — дубль в строке не нужен. */
  promptShown?: boolean;
}

/** Строка под заголовком ленты: где мы показываем предложения и что можно сделать (определить меня / весь город / как включить). */
export function GeoStatusLine({ geo, sort, onSort, onLocate, onReset, promptShown = false }: GeoStatusLineProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { status, located, outside } = geo;
  const hasApi = typeof navigator !== "undefined" && "geolocation" in navigator;
  const retryable = status === "timeout" || status === "denied" || (status === "unavailable" && hasApi);

  return (
    <div className="showcase-sub">
      <span role="status">{geoMessage(geo, sort)}</span>

      {status === "locating" ? (
        <span className="geo-chip is-busy" aria-hidden="true">
          <span className="spinner spinner-sm" />
        </span>
      ) : located || outside ? (
        <button type="button" className="geo-chip" onClick={onReset}>
          <X size={14} aria-hidden="true" /> Весь город
        </button>
      ) : status === "idle" ? (
        promptShown ? null : (
          <button type="button" className="geo-chip is-primary" onClick={onLocate}>
            <LocateFixed size={14} aria-hidden="true" /> Рядом со мной
          </button>
        )
      ) : retryable ? (
        <>
          {status === "denied" ? (
            <button type="button" className="geo-chip" aria-expanded={helpOpen} aria-controls="geo-help" onClick={() => setHelpOpen((value) => !value)}>
              Как включить
            </button>
          ) : null}
          <button type="button" className="geo-chip is-primary" onClick={onLocate}>
            <RotateCw size={14} aria-hidden="true" /> Повторить
          </button>
        </>
      ) : null}

      {located ? (
        <span className="showcase-sort" role="group" aria-label="Порядок предложений">
          <button type="button" aria-pressed={sort === "near"} onClick={() => onSort("near")}>
            Ближайшие
          </button>
          <button type="button" aria-pressed={sort === "hot"} onClick={() => onSort("hot")}>
            Сначала горящие
          </button>
        </span>
      ) : null}

      {status === "denied" && helpOpen ? <DeniedHelp /> : null}
    </div>
  );
}

interface GeoPromptProps {
  onAllow: () => void;
  onDismiss: () => void;
}

/**
 * Мягкое приглашение при первом заходе: объясняем, зачем позиция, ДО системного диалога браузера (после него отказ
 * часто навсегда). Системный запрос уходит только по нажатию «Определить».
 */
export function GeoPrompt({ onAllow, onDismiss }: GeoPromptProps) {
  return (
    <aside className="geo-prompt" aria-label="Геолокация">
      <span className="geo-prompt-icon" aria-hidden="true">
        <MapPinned size={22} strokeWidth={2.2} />
      </span>
      <div className="geo-prompt-text">
        <strong>Показать ближайшие предложения первыми?</strong>
        <span>Браузер один раз спросит доступ к геопозиции. Она нужна, только чтобы найти предложения рядом с вами.</span>
      </div>
      <div className="geo-prompt-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onAllow}>
          Определить местоположение
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
          Не сейчас
        </button>
      </div>
    </aside>
  );
}

interface MapLocateButtonProps {
  status: GeoStatus;
  located: boolean;
  onClick: () => void;
}

/** Круглая кнопка на карте: определить меня / вернуться к себе. Рядом с картой, а не только в шапке ленты, — жест, который ждут от любой карты. */
export function MapLocateButton({ status, located, onClick }: MapLocateButtonProps) {
  const busy = status === "locating";
  return (
    <button
      type="button"
      className={`map-locate-btn${located ? " is-active" : ""}`}
      onClick={onClick}
      disabled={busy || status === "insecure"}
      aria-label={located ? "Вернуться к моему местоположению" : "Определить моё местоположение"}
      title={status === "insecure" ? "Геолокация работает только по HTTPS" : undefined}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : <LocateFixed size={20} strokeWidth={2.3} aria-hidden="true" />}
    </button>
  );
}
