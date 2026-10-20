import { describe, expect, it } from "vitest";
import type { NearbyOffer } from "@apetite/shared";
import { createPinNode } from "./mapPinDom";
import { pinScaleForZoom, pinSpec, pinZIndex } from "./mapPins";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const end = (hours: number) => new Date(NOW + hours * 3600_000).toISOString();
type TestOffer = Pick<NearbyOffer, "discountPercent" | "pickupEnd"> & { featured?: boolean; imageUrl?: string | null };
const offer = (over: Partial<TestOffer> = {}): TestOffer => ({ discountPercent: 55, pickupEnd: end(0.5), imageUrl: "/uploads/offers/a.jpg", ...over });

describe("pinSpec: photo markers for hot offers", () => {
  it("hot offer with a photo becomes a photo pin carrying an absolute photo URL", () => {
    const spec = pinSpec(offer(), false, NOW);
    expect(spec.kind).toBe("photo");
    expect(spec.photoUrl).toMatch(/\/uploads\/offers\/a\.jpg$/);
    expect(spec.photoUrl).toMatch(/^https?:\/\//);
  });

  it("a calm offer (lots of time left) stays a drop even if it has a photo", () => {
    expect(pinSpec(offer({ pickupEnd: end(6) }), false, NOW).kind).toBe("drop");
  });

  it("a hot offer WITHOUT a photo stays a drop — nothing to show in the circle", () => {
    expect(pinSpec(offer({ imageUrl: null }), false, NOW).kind).toBe("drop");
    expect(pinSpec(offer({ imageUrl: undefined }), false, NOW).kind).toBe("drop");
  });

  it("the featured offer is hot all day and gets the biggest unselected photo pin", () => {
    const featured = pinSpec(offer({ pickupEnd: end(24), featured: true }), false, NOW);
    const regular = pinSpec(offer(), false, NOW);
    expect(featured.kind).toBe("photo");
    expect(featured.size).toBeGreaterThan(regular.size);
    expect(pinSpec(offer(), true, NOW).size).toBeGreaterThan(featured.size);
  });

  it("photo pins are small icons, not posters", () => {
    expect(pinSpec(offer(), false, NOW).size).toBeLessThanOrEqual(56);
  });

  it("an expired window is never hot, so never a photo pin", () => {
    expect(pinSpec(offer({ pickupEnd: end(-1) }), false, NOW).kind).toBe("drop");
  });
});

describe("pinZIndex", () => {
  it("orders selected > featured > hot photo > drops by discount", () => {
    const selected = pinZIndex(offer(), true, NOW);
    const featured = pinZIndex(offer({ featured: true, pickupEnd: end(24) }), false, NOW);
    const photo = pinZIndex(offer({ discountPercent: 40 }), false, NOW);
    const bigDrop = pinZIndex(offer({ discountPercent: 70, pickupEnd: end(6) }), false, NOW);
    expect(selected).toBeGreaterThan(featured);
    expect(featured).toBeGreaterThan(photo);
    expect(photo).toBeGreaterThan(bigDrop);
  });
});

describe("createPinNode", () => {
  it("builds a photo pin: round photo, discount badge, tail height added to the anchor box", () => {
    const { node, width, height } = createPinNode(offer(), false, NOW);
    expect(node.classList.contains("map-pin-photo")).toBe(true);
    const img = node.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(/\/uploads\/offers\/a\.jpg$/);
    expect(img.getAttribute("alt")).toBe(""); // декоративная: у метки своё имя (aria-label/title)
    expect(node.querySelector(".map-pin-photo-badge")!.textContent).toBe("−55%");
    expect(node.style.getPropertyValue("--pin")).toBe(`${width}px`);
    expect(height).toBeGreaterThan(width);
  });

  it("marks selected and featured pins for the CSS", () => {
    const { node } = createPinNode(offer({ featured: true, pickupEnd: end(24) }), true, NOW);
    expect(node.classList.contains("is-selected")).toBe(true);
    expect(node.classList.contains("is-featured")).toBe(true);
  });

  it("builds the classic drop for everything else — a square box and the discount text", () => {
    const { node, width, height } = createPinNode(offer({ pickupEnd: end(6), discountPercent: 45 }), false, NOW);
    expect(node.classList.contains("map-pin")).toBe(true);
    expect(node.querySelector("img")).toBeNull();
    expect(node.textContent).toBe("−45%");
    expect(width).toBe(height);
  });

  it("never turns the photo URL into markup (it comes from the API)", () => {
    const evil = 'x" onerror="alert(1)';
    const { node } = createPinNode(offer({ imageUrl: `https://cdn.example/${evil}.jpg` }), false, NOW);
    const img = node.querySelector("img")!;
    expect(img.hasAttribute("onerror")).toBe(false);
    expect(node.querySelectorAll("*").length).toBe(3); // disc, img, badge — ничего лишнего не «выросло» из строки
  });

  it("a broken photo disappears and leaves the coloured circle with the badge", () => {
    const { node } = createPinNode(offer(), false, NOW);
    node.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(node.querySelector("img")).toBeNull();
    expect(node.querySelector(".map-pin-photo-disc")).not.toBeNull();
    expect(node.querySelector(".map-pin-photo-badge")).not.toBeNull();
  });
});


describe("pin scale by zoom ('иконки меньше' на общем виде города)", () => {
  it("is smaller at city overview, full size when zoomed in, and never grows as you zoom OUT", () => {
    expect(pinScaleForZoom(10)).toBeLessThan(pinScaleForZoom(14));
    expect(pinScaleForZoom(14)).toBe(1);
    expect(pinScaleForZoom(18)).toBe(1);
    const zooms = [8, 10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15];
    const scales = zooms.map(pinScaleForZoom);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.7); // не крошечные: метка остаётся читаемой и нажимаемой
  });

  it("shrinks ordinary pins with the scale but never the selected one", () => {
    const o = offer();
    expect(pinSpec(o, false, NOW, 0.75).size).toBeLessThan(pinSpec(o, false, NOW, 1).size);
    expect(pinSpec(o, true, NOW, 0.75).size).toBe(pinSpec(o, true, NOW, 1).size);
    const calm = offer({ pickupEnd: end(6) });
    expect(pinSpec(calm, false, NOW, 0.75).size).toBeLessThan(pinSpec(calm, false, NOW, 1).size);
  });

  it("keeps the discount legible: the label font does not collapse below 8 px", () => {
    expect(pinSpec(offer({ pickupEnd: end(6) }), false, NOW, 0.5).fontSize).toBeGreaterThanOrEqual(8);
  });

  it("the whole base set is small: drops ≤ 38 px, photo icons ≤ 48 px (unselected)", () => {
    expect(pinSpec(offer({ pickupEnd: end(6), discountPercent: 70 }), false, NOW).size).toBeLessThanOrEqual(38);
    expect(pinSpec(offer({ pickupEnd: end(6), discountPercent: 30 }), false, NOW).size).toBeLessThanOrEqual(32);
    expect(pinSpec(offer(), false, NOW).size).toBeLessThanOrEqual(42);
    expect(pinSpec(offer({ featured: true, pickupEnd: end(24) }), false, NOW).size).toBeLessThanOrEqual(48);
  });

  it("createPinNode builds the smaller pin box too (hit area follows the visible pin)", () => {
    const big = createPinNode(offer(), false, NOW, 1);
    const small = createPinNode(offer(), false, NOW, 0.75);
    expect(small.width).toBeLessThan(big.width);
    expect(small.height).toBeLessThan(big.height);
  });
});
