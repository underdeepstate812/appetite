import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { LEAFLET_ATTRIBUTION_PREFIX } from "../utils/leafletAttribution";

interface LocationPickerModalProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onConfirm: (point: { lat: number; lng: number }) => void;
}

/**
 * Карта поверх формы онбординга (ШАГ 11) — тот же приём с DivIcon-маркером и dynamic
 * import("leaflet"), что и в apps/web/mobile LeafletMapView: клик/драг маркера ставит
 * точку заведения без ввода широты/долготы руками. Модалка переиспользует Modal —
 * её overlay уже адаптивный (padding у краёв, maxHeight 90vh, скролл), отдельных
 * мобильных брейкпоинтов карте заводить не потребовалось.
 */
export function LocationPickerModal({ lat, lng, onClose, onConfirm }: LocationPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [point, setPoint] = useState({ lat, lng });

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      if (!document.getElementById("apetite-admin-leaflet-css")) {
        const link = document.createElement("link");
        link.id = "apetite-admin-leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(containerRef.current, { attributionControl: true }).setView([lat, lng], 15);
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const icon = L.divIcon({
        className: "apetite-admin-marker",
        html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2f6f5e;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setPoint({ lat: pos.lat, lng: pos.lng });
      });
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Точка на карте" onClose={onClose}>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
        Кликни по карте или перетащи маркер, чтобы уточнить точку заведения.
      </p>
      <div ref={containerRef} style={{ height: 320, borderRadius: "var(--radius-sm)", overflow: "hidden" }} />
      <p style={{ fontSize: 13, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
        {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onConfirm(point)}>
          Подтвердить точку
        </button>
        <button className="btn btn-secondary" onClick={onClose}>
          Отмена
        </button>
      </div>
    </Modal>
  );
}
