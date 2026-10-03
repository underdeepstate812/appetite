import { heatBand, heatColor, heatInk, heatStops, heatTint, mixColors } from "./heat";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("mixColors", () => {
  it("returns the endpoints at 0 and 1 and the midpoint in between", () => {
    expect(mixColors("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColors("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixColors("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("clamps the amount", () => {
    expect(mixColors("#102030", "#405060", 5)).toBe("#405060");
    expect(mixColors("#102030", "#405060", -1)).toBe("#102030");
  });
});

describe("heatBand", () => {
  it("switches bands at the 120 / 81 / 31 minute thresholds", () => {
    expect(heatBand(0)).toBe("calm");
    expect(heatBand(0.32)).toBe("calm");
    expect(heatBand(0.33)).toBe("warm");
    expect(heatBand(0.55)).toBe("hot");
    expect(heatBand(0.83)).toBe("crit");
    expect(heatBand(1)).toBe("crit");
  });
});

describe("heatColor", () => {
  it("keeps calm offers teal for the first part of the window (plateau) and turns red only at the end", () => {
    expect(heatColor(0.2, "dark")).toBe("#2dd4bf");
    expect(heatColor(0.6, "dark")).not.toBe("#ff5c4d");
    expect(heatColor(0.95, "dark")).toBe("#ff5c4d");
    expect(heatColor(0.3, "light")).not.toBe(heatColor(0, "light"));
  });

  it("holds the hot orange steady between the hot plateau stops", () => {
    expect(heatColor(0.62, "dark")).toBe("#ff8a3d");
    expect(heatColor(0.7, "dark")).toBe("#ff8a3d");
    expect(heatColor(0.78, "dark")).toBe("#ff8a3d");
  });

  it("clamps out of range values to the ends of the ramp", () => {
    expect(heatColor(-3, "light")).toBe(heatColor(0, "light"));
    expect(heatColor(9, "light")).toBe(heatColor(1, "light"));
  });
});

describe("heatInk (text colour)", () => {
  const surfaces = {
    dark: { text: "#EDF5F3", surfaces: ["#0B1110", "#121A19", "#18221F"] },
    light: { text: "#16201E", surfaces: ["#FFFCF6", "#F6F1E8", "#FFFFFF"] },
  } as const;

  it.each(["dark", "light"] as const)("stays at least AA (4.5:1) on every surface and every ratio in %s theme", (mode) => {
    for (let ratio = 0; ratio <= 1.0001; ratio += 0.05) {
      const ink = heatInk(ratio, mode, surfaces[mode].text);
      for (const surface of surfaces[mode].surfaces) {
        expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("heatTint", () => {
  it("is a light wash of the heat colour over the background", () => {
    const tint = heatTint(1, "light", "#ffffff");
    expect(tint).not.toBe("#ffffff");
    expect(tint).not.toBe(heatColor(1, "light"));
  });
});

describe("heatStops", () => {
  it("exposes the ramp anchors in order for gradients", () => {
    const stops = heatStops("dark");
    expect(stops[0]).toEqual([0, "#2dd4bf"]);
    expect(stops[stops.length - 1]).toEqual([1, "#ff5c4d"]);
    expect(stops.map(([position]) => position)).toEqual([...stops.map(([position]) => position)].sort((a, b) => a - b));
  });
});
