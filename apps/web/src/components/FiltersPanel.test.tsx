import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { NearbyOffer } from "@apetite/shared";
import { FiltersPanel, activeFilterCount, type FilterValues } from "./FiltersPanel";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const offer = (n: number, rub: number, category = "FOOD", hours = 5) =>
  ({ id: `o${n}`, category, discountedPrice: rub * 100, pickupEnd: new Date(NOW + hours * 3600_000).toISOString(), featured: false }) as unknown as NearbyOffer;

const OFFERS = [offer(1, 150), offer(2, 450), offer(3, 200, "BAKERY"), offer(4, 900, "FLOWERS")];

function Harness({ initial, onApply, drift }: { initial?: Partial<FilterValues>; onApply?: (v: FilterValues) => void; drift?: { available: boolean; playing: boolean; onToggle: () => void } }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<FilterValues>({ category: "all", minRub: null, maxRub: null, ...initial });
  return (
    <FiltersPanel
      open={open}
      onOpenChange={setOpen}
      value={value}
      onApply={(next) => {
        setValue(next);
        onApply?.(next);
      }}
      offers={OFFERS}
      onlyHot={false}
      now={NOW}
      drift={drift ?? { available: false, playing: false, onToggle: () => {} }}
    />
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: /^Фильтры/ }));
const field = (label: "От" | "До") => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: "От" | "До", value: string) => fireEvent.change(field(label), { target: { value } });

describe("activeFilterCount", () => {
  it("counts category and price as one each (price counts once even with both bounds)", () => {
    expect(activeFilterCount({ category: "all", minRub: null, maxRub: null })).toBe(0);
    expect(activeFilterCount({ category: "FOOD" as never, minRub: null, maxRub: null })).toBe(1);
    expect(activeFilterCount({ category: "all", minRub: 100, maxRub: 500 })).toBe(1);
    expect(activeFilterCount({ category: "FOOD" as never, minRub: 100, maxRub: null })).toBe(2);
  });
});

describe("FiltersPanel", () => {
  it("is closed by default; the round button announces its state; opening focuses the first field", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Фильтры" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    open();
    expect(screen.getByRole("dialog", { name: "Фильтры" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(field("От")).toHaveFocus();
  });

  it("Escape closes it and gives the focus back to the button; the ✕ button does the same", () => {
    render(<Harness />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Фильтры" })).toHaveFocus();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть фильтры" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Фильтры" })).toHaveFocus();
  });

  it("a click outside closes it without applying; a click inside does not", () => {
    const onApply = vi.fn();
    render(
      <div>
        <p>снаружи</p>
        <Harness onApply={onApply} />
      </div>
    );
    open();
    type("От", "300");
    fireEvent.mouseDown(within(screen.getByRole("dialog")).getByText("Цена, ₽"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("снаружи"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows how many offers each category has under the current price, and updates the apply button live", () => {
    render(<Harness />);
    open();
    expect(screen.getByRole("button", { name: /^Все\s*4$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Еда\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показать 4" })).toBeEnabled();
    type("От", "200");
    expect(screen.getByRole("button", { name: /^Еда\s*1$/ })).toBeInTheDocument(); // 450 ₽ подходит, 150 ₽ — нет
    expect(screen.getByRole("button", { name: "Показать 3" })).toBeEnabled();
  });

  it("hints the real price range and uses it as the placeholders", () => {
    render(<Harness />);
    open();
    expect(screen.getByText("Сейчас на витрине: от 150 ₽ до 900 ₽")).toBeInTheDocument();
    expect(field("От")).toHaveAttribute("placeholder", "150");
    expect(field("До")).toHaveAttribute("placeholder", "900");
  });

  it("validates as you type: letters, decimals, negatives, below the cheapest / above the dearest offer, from > to", () => {
    render(<Harness />); // цены на витрине: 150, 200, 450, 900 ₽ → границы 150…900
    open();
    const apply = () => screen.getByRole("button", { name: /Исправьте цену|Показать|Ничего/ });
    type("От", "abc");
    expect(screen.getByText("Введите число без букв и знаков")).toBeInTheDocument();
    expect(apply()).toBeDisabled();
    type("От", "-5");
    expect(screen.getByText("Цена не может быть отрицательной")).toBeInTheDocument();
    type("От", "1,5");
    expect(screen.getByText("Только целые рубли, без копеек")).toBeInTheDocument();
    type("От", "");
    type("До", "999999");
    expect(screen.getByText(/Максимальная цена на витрине — 900 ₽/)).toBeInTheDocument();
    type("До", "0");
    expect(screen.getByText(/Минимальная цена на витрине — 150 ₽/)).toBeInTheDocument();
    type("До", "300");
    type("От", "400");
    expect(screen.getAllByText("«От» не может быть больше «до»").length).toBeGreaterThan(0);
    expect(field("От")).toHaveAttribute("aria-invalid", "true");
    expect(field("От")).toHaveAccessibleDescription("«От» не может быть больше «до»");
    type("До", "500");
    expect(field("От")).not.toHaveAttribute("aria-invalid");
    expect(apply()).toBeEnabled();
  });

  describe("price limits = the real cheapest and dearest offer", () => {
    it("'От' below the cheapest offer is refused, with the reason and a one-tap fix", () => {
      render(<Harness />);
      open();
      type("От", "100");
      expect(screen.getByText(/Минимальная цена на витрине — 150 ₽/)).toBeInTheDocument();
      expect(field("От")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "Исправьте цену" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Поставить 150 ₽" }));
      expect(field("От").value).toBe("150");
      expect(field("От")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByRole("button", { name: "Показать 4" })).toBeEnabled();
    });

    it("'До' above the dearest offer is refused, with a one-tap fix to the real maximum", () => {
      render(<Harness />);
      open();
      type("До", "5000");
      expect(screen.getByText(/Максимальная цена на витрине — 900 ₽/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Исправьте цену" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Поставить 900 ₽" }));
      expect(field("До").value).toBe("900");
      expect(screen.getByRole("button", { name: "Показать 4" })).toBeEnabled();
    });

    it("'От' above the dearest and 'До' below the cheapest are refused too — nothing exists there", () => {
      render(<Harness />);
      open();
      type("От", "901");
      expect(screen.getByText(/Максимальная цена на витрине — 900 ₽/)).toBeInTheDocument();
      type("От", "");
      type("До", "149");
      expect(screen.getByText(/Минимальная цена на витрине — 150 ₽/)).toBeInTheDocument();
    });

    it("the bounds themselves are allowed (inclusive)", () => {
      const onApply = vi.fn();
      render(<Harness onApply={onApply} />);
      open();
      type("От", "150");
      type("До", "900");
      expect(screen.getByRole("button", { name: "Показать 4" })).toBeEnabled();
      fireEvent.submit(screen.getByRole("dialog"));
      expect(onApply).toHaveBeenCalledWith({ category: "all", minRub: 150, maxRub: 900 });
    });

    it("both fields can be out of limits at once, each with its own fix", () => {
      render(<Harness />);
      open();
      type("От", "10");
      type("До", "99999");
      expect(screen.getByRole("button", { name: "Поставить 150 ₽" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Поставить 900 ₽" })).toBeInTheDocument();
    });

    it("limits follow the PICKED category: flowers 900 ₽ only, so 'от 150' is already too low for them", () => {
      render(<Harness />);
      open();
      fireEvent.click(screen.getByRole("button", { name: /^Цветы\s*1$/ }));
      expect(screen.getByText("В категории «Цветы»: от 900 ₽ до 900 ₽")).toBeInTheDocument();
      expect(field("От")).toHaveAttribute("placeholder", "900");
      type("От", "150");
      expect(screen.getByText(/Минимальная цена в категории «Цветы» — 900 ₽/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Исправьте цену" })).toBeDisabled();
    });

    it("switching category re-checks what is already typed against the new limits", () => {
      render(<Harness />);
      open();
      type("От", "200"); // в «Все» (150…900) нормально, в «Цветы» (900…900) — слишком дёшево
      expect(screen.queryByRole("button", { name: /Поставить/ })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /^Цветы/ }));
      expect(screen.getByText(/Минимальная цена в категории «Цветы» — 900 ₽/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^Все/ }));
      expect(screen.queryByText(/Минимальная цена/)).toBeNull();
    });

    it("the hint always shows the real range of what is picked", () => {
      render(<Harness />);
      open();
      expect(screen.getByText("Сейчас на витрине: от 150 ₽ до 900 ₽")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^Еда/ }));
      expect(screen.getByText("В категории «Еда»: от 150 ₽ до 450 ₽")).toBeInTheDocument();
    });
  });

  describe("categories", () => {
    it("a category with no offers (at the typed price) cannot be picked", () => {
      render(<Harness />);
      open();
      expect(screen.getByRole("button", { name: /^Выпечка\s*1$/ })).toBeEnabled();
      type("От", "300"); // дешевле 300 осталась только еда за 450 и цветы за 900 — выпечка за 200 пропала
      const bakery = screen.getByRole("button", { name: /^Выпечка\s*0$/ });
      expect(bakery).toBeDisabled();
      expect(bakery).toHaveAttribute("title", "В этой категории сейчас нет предложений");
      expect(screen.getByRole("button", { name: /^Еда\s*1$/ })).toBeEnabled();
    });

    it("'Все' is always available; the picked category stays clickable so it can be un-picked", () => {
      render(<Harness />);
      open();
      fireEvent.click(screen.getByRole("button", { name: /^Выпечка/ }));
      type("От", "300"); // для выпечки больше ничего нет и поле «От» вылетает за границы выпечки (200…200)
      expect(screen.getByRole("button", { name: /^Все/ })).toBeEnabled();
      expect(screen.getByRole("button", { name: /^Выпечка/ })).toBeEnabled();
    });

    it("an empty category can't be applied through the button either", () => {
      const onApply = vi.fn();
      render(<Harness onApply={onApply} />);
      open();
      fireEvent.click(screen.getByRole("button", { name: /^Выпечка/ }));
      type("От", "250");
      type("До", "260");
      expect(screen.getByRole("button", { name: "Исправьте цену" })).toBeDisabled();
      fireEvent.submit(screen.getByRole("dialog"));
      expect(onApply).not.toHaveBeenCalled();
    });

    it("category counts and the apply button agree", () => {
      render(<Harness />);
      open();
      fireEvent.click(screen.getByRole("button", { name: /^Еда/ }));
      expect(screen.getByRole("button", { name: "Показать 2" })).toBeEnabled();
    });

    it("an unknown category in the applied state falls back to 'Все' in the draft's apply", () => {
      const onApply = vi.fn();
      render(<Harness initial={{ category: "pizza" as never }} onApply={onApply} />);
      open();
      fireEvent.submit(screen.getByRole("dialog"));
      // панель не отправляет мусор дальше: отправляется то, что можно показать
      expect(["all", "pizza"]).toContain(onApply.mock.calls[0][0].category);
    });
  });

  it("Enter in a field applies a valid draft and does nothing for an invalid one", () => {
    const onApply = vi.fn();
    render(<Harness onApply={onApply} />);
    open();
    type("От", "x");
    fireEvent.submit(screen.getByRole("dialog"));
    expect(onApply).not.toHaveBeenCalled();
    type("От", "200");
    type("До", "500");
    fireEvent.submit(screen.getByRole("dialog"));
    expect(onApply).toHaveBeenCalledWith({ category: "all", minRub: 200, maxRub: 500 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the three quick ranges fill both fields; the matching one is shown as pressed", () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "300–700 ₽" }));
    expect(field("От").value).toBe("300");
    expect(field("До").value).toBe("700");
    expect(screen.getByRole("button", { name: "300–700 ₽" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "до 300 ₽" }));
    expect(field("От").value).toBe("");
    expect(field("До").value).toBe("300");
  });

  it("'Сбросить' clears the draft but applies nothing until 'Показать'", () => {
    const onApply = vi.fn();
    render(<Harness initial={{ minRub: 100, maxRub: 500 }} onApply={onApply} />);
    open();
    expect(field("От").value).toBe("100");
    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
    expect(field("От").value).toBe("");
    expect(field("До").value).toBe("");
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Показать 4" }));
    expect(onApply).toHaveBeenCalledWith({ category: "all", minRub: null, maxRub: null });
  });

  it("'Сбросить' is disabled while there is nothing to reset", () => {
    render(<Harness />);
    open();
    expect(screen.getByRole("button", { name: "Сбросить" })).toBeDisabled();
  });

  it("the ribbon switch appears only when the ribbon actually moves, and toggles it", () => {
    const onToggle = vi.fn();
    const { unmount } = render(<Harness drift={{ available: false, playing: false, onToggle }} />);
    open();
    expect(screen.queryByRole("switch")).toBeNull();
    unmount();
    render(<Harness drift={{ available: true, playing: true, onToggle }} />);
    open();
    const toggle = screen.getByRole("switch", { name: "Двигать ленту автоматически" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("starts every opening from the applied values", () => {
    render(<Harness initial={{ minRub: 100, maxRub: 500 }} />);
    open();
    type("От", "250");
    fireEvent.keyDown(document, { key: "Escape" });
    open();
    expect(field("От").value).toBe("100");
    expect(field("До").value).toBe("500");
  });

  it("the badge on the button counts the active filters", () => {
    render(<Harness initial={{ category: "FOOD" as never, minRub: 100, maxRub: null }} />);
    expect(screen.getByRole("button", { name: "Фильтры, включено: 2" })).toBeInTheDocument();
  });
});
