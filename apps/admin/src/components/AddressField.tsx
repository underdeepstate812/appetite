import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { LocationPickerModal } from "./LocationPickerModal";

const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };
const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressFieldProps {
  address: string;
  lat: number;
  lng: number;
  onChange: (next: { address: string; lat: number; lng: number }) => void;
}

/**
 * Замена ручного ввода широты/долготы (ШАГ 11): подсказки адреса берём у Nominatim
 * (OpenStreetMap) — без ключа и аккаунта, тем же провайдером, что уже используют карты
 * в apps/web/mobile (LeafletMapView), просто другой его REST-эндпоинт. Выбор подсказки
 * сразу даёт и адрес, и координаты; иконка на карте — ручная докорректировка точки,
 * когда геокодер промахнулся (частый случай для новостроек/дворовых точек входа).
 */
export function AddressField({ address, lat, lng, onChange }: AddressFieldProps) {
  const [query, setQuery] = useState(address);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Пока подсказку не выбрали, координаты держим прежними — обнулять на каждое
    // нажатие клавиши не нужно, choose из dropdown или карта задают их явно.
    onChange({ address: value, lat, lng });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", value);
      url.searchParams.set("countrycodes", "ru");
      url.searchParams.set("limit", "5");
      // Смещаем выдачу к пилотному городу (Санкт-Петербург) — не жёсткий фильтр,
      // просто приоритизация совпадений рядом.
      url.searchParams.set("viewbox", "29.5,60.3,30.9,59.6");
      url.searchParams.set("bounded", "0");

      fetch(url.toString(), { signal: controller.signal })
        .then((response) => response.json() as Promise<NominatimResult[]>)
        .then((results) => {
          setSuggestions(results);
          setOpen(true);
        })
        .catch((error) => {
          if (error.name !== "AbortError") setSuggestions([]);
        })
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelect = (result: NominatimResult) => {
    const next = { address: result.display_name, lat: Number(result.lat), lng: Number(result.lon) };
    setQuery(next.address);
    onChange(next);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="field" ref={wrapRef} style={{ position: "relative" }}>
      <label htmlFor="address">Адрес</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="address"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
          placeholder="Начни вводить адрес..."
          required
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          aria-label="Уточнить точку на карте"
          title="Уточнить точку на карте"
          onClick={() => setShowMap(true)}
          style={{ flexShrink: 0, padding: "0 14px" }}
        >
          <MapPin size={17} aria-hidden="true" />
        </button>
      </div>

      {open && (suggestions.length > 0 || loading) ? (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-card)",
            listStyle: "none",
            padding: 4,
            zIndex: 20,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {loading ? (
            <li style={{ padding: "8px 10px", fontSize: 13, color: "var(--color-text-muted)" }}>Ищем...</li>
          ) : (
            suggestions.map((result) => (
              <li key={`${result.lat}-${result.lon}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(result)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: 13,
                    background: "none",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(event) => (event.currentTarget.style.background = "var(--color-surface)")}
                  onMouseLeave={(event) => (event.currentTarget.style.background = "none")}
                >
                  {result.display_name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {showMap ? (
        <LocationPickerModal
          lat={lat || SPB_CENTER.lat}
          lng={lng || SPB_CENTER.lng}
          onClose={() => setShowMap(false)}
          onConfirm={(point) => {
            onChange({ address: query, ...point });
            setShowMap(false);
          }}
        />
      ) : null}
    </div>
  );
}
