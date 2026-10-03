import ru from "./locales/ru.json";
import en from "./locales/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const RU = flatten(ru as Tree);
const EN = flatten(en as Tree);
const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe("locale files", () => {
  it("have exactly the same keys in Russian and English", () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(RU).sort());
  });

  it("have no empty translations", () => {
    const empty = [...Object.entries(RU), ...Object.entries(EN)].filter(([, value]) => value.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("use the same interpolation placeholders in both languages", () => {
    const mismatched = Object.keys(RU).filter((key) => JSON.stringify(placeholders(RU[key])) !== JSON.stringify(placeholders(EN[key] ?? "")));
    expect(mismatched).toEqual([]);
  });

  it("contain no Cyrillic in the English file except the language names themselves", () => {
    const leaked = Object.entries(EN).filter(([key, value]) => /[А-Яа-яЁё]/.test(value) && key !== "profile.languageRu");
    expect(leaked.map(([key]) => key)).toEqual([]);
  });

  it("contain no emoji left in UI strings", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const found = [...Object.entries(RU), ...Object.entries(EN)].filter(([, value]) => emoji.test(value)).map(([key]) => key);
    expect(found).toEqual([]);
  });
});
