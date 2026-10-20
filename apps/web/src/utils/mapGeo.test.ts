import { describe, expect, it } from "vitest";
import { offsetFromSheet, shiftedCenter } from "./mapGeo";

describe("shiftedCenter", () => {
  it("keeps the point when no shift is requested", () => {
    expect(shiftedCenter(59.93, 30.36, 16, 0, 0)).toEqual([30.36, 59.93]);
  });

  it("moves the centre WEST for dx>0 so the point appears to the right of centre; smaller shift at higher zoom", () => {
    const [lng16] = shiftedCenter(59.93, 30.36, 16, 200, 0);
    const [lng14] = shiftedCenter(59.93, 30.36, 14, 200, 0);
    expect(lng16).toBeLessThan(30.36);
    expect(30.36 - lng14).toBeGreaterThan(30.36 - lng16);
  });

  it("moves the centre SOUTH for dy>0 so the point appears above centre", () => {
    const [, lat] = shiftedCenter(59.93, 30.36, 16, 0, 150);
    expect(lat).toBeLessThan(59.93);
  });
});

describe("offsetFromSheet", () => {
  it("is zero while no offer sheet is open", () => {
    expect(offsetFromSheet(1000, 600, null)).toEqual({ dx: 0, dy: 0 });
  });

  it("wide map, sheet on the left: the pin goes to the middle of the free area to its right", () => {
    // шторка занимает 0..414 из 1000 → середина свободной части = 707, центр карты = 500 → сдвиг 207
    expect(offsetFromSheet(1000, 600, { left: 14, right: 414, top: 40 })).toEqual({ dx: 207, dy: 0 });
  });

  it("phone, sheet at the bottom: the pin goes above centre, into the strip over the sheet", () => {
    const { dx, dy } = offsetFromSheet(390, 640, { left: 8, right: 382, top: 300 });
    expect(dx).toBe(0);
    // полоса над шторкой 0..300: середина 150, остриё на 150 + 29 = 179 → выше центра (320) на 141
    expect(dy).toBeCloseTo(141);
  });

  it("a taller sheet pushes the pin higher than a short one — the fixed 20% used to hide it", () => {
    const short = offsetFromSheet(390, 640, { left: 8, right: 382, top: 400 }).dy;
    const tall = offsetFromSheet(390, 640, { left: 8, right: 382, top: 200 }).dy;
    expect(tall).toBeGreaterThan(short);
  });

  it("never pushes the pin past the top edge of the map when almost everything is covered", () => {
    const { dy } = offsetFromSheet(390, 440, { left: 8, right: 382, top: 60 });
    // центр метки не выше 41 px, остриё — на 70 px от верха
    expect(440 / 2 - dy).toBeCloseTo(70);
  });
});
