import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? sources(rel) : /\.(tsx|css)$/.test(name) && !/\.test\./.test(name) ? [rel] : [];
  });
}

describe("тёмная тема: панели, которые тёмные в обеих темах", () => {
  it("не красятся инверсией --color-ink: на тёмной теме ink светлый и панель стала бы светлой с невидимым текстом", () => {
    const offenders = sources("").filter((file) => /background(-color)?:\s*"?var\(--color-ink\)/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("токены панели заданы в обеих темах", () => {
    expect(read("styles/global.css")).toMatch(/--panel-dark:\s*#12100d/);
    expect(read("styles/dark.css")).toMatch(/--panel-dark:\s*#[0-9a-f]{6}/i);
  });

  it("на тёмных панелях текст не берёт --color-primary-soft (в тёмной теме это тёмная заливка)", () => {
    const offenders = ["pages/BusinessRegisterPage.tsx", "pages/LandingPage.tsx", "components/Stamp.tsx"].filter((file) => /color:\s*"?var\(--color-primary-soft\)/.test(read(file)));
    expect(offenders).toEqual([]);
  });
});
