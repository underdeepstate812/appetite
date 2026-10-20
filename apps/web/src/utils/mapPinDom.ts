import type { NearbyOffer } from "@apetite/shared";
import { pinSpec } from "./mapPins";

/** Хвостик под кружком с фото: остриё — ровно в точке заведения. */
const PHOTO_TAIL = 10;

export interface PinNode {
  node: HTMLElement;
  /** Габариты узла: Leaflet-иконке нужны iconSize/iconAnchor (остриё — низ по центру). */
  width: number;
  height: number;
}

type PinOffer = Pick<NearbyOffer, "discountPercent" | "pickupEnd"> & { featured?: boolean; imageUrl?: string | null };

/**
 * DOM пина, общий для Leaflet и Яндекса. Собирается через DOM API, а не HTML-строкой: ссылка на фото приходит
 * из API, и в разметку она попадать не должна. Битое фото просто исчезает — остаётся цветной круг со скидкой.
 */
export function createPinNode(offer: PinOffer, selected: boolean, now: number = Date.now(), scale: number = 1): PinNode {
  const spec = pinSpec(offer, selected, now, scale);
  const flags = `${selected ? " is-selected" : ""}${spec.featured ? " is-featured" : ""}`;

  if (spec.kind === "photo" && spec.photoUrl) {
    const root = document.createElement("div");
    root.className = `map-pin-photo${flags}`;
    root.style.setProperty("--pin", `${spec.size}px`);
    root.style.setProperty("--pin-color", spec.color);

    const disc = document.createElement("span");
    disc.className = "map-pin-photo-disc";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    img.addEventListener("error", () => img.remove());
    img.src = spec.photoUrl;
    disc.appendChild(img);

    const badge = document.createElement("span");
    badge.className = "map-pin-photo-badge";
    badge.textContent = spec.text;

    root.append(disc, badge);
    return { node: root, width: spec.size, height: spec.size + PHOTO_TAIL };
  }

  const pin = document.createElement("div");
  pin.className = `map-pin${flags}`;
  pin.style.width = `${spec.size}px`;
  pin.style.height = `${spec.size}px`;
  pin.style.background = spec.color;
  const label = document.createElement("span");
  label.style.fontSize = `${spec.fontSize}px`;
  label.textContent = spec.text;
  pin.appendChild(label);
  return { node: pin, width: spec.size, height: spec.size };
}
