import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

const OPTIONS = [
  { value: "food", label: "Кафе / ресторан" },
  { value: "bakery", label: "Пекарня / кондитерская" },
  { value: "flowers", label: "Цветочный магазин" },
  { value: "groceries", label: "Продуктовый магазин" },
] as const;

type Value = (typeof OPTIONS)[number]["value"];

function Harness({ onChange }: { onChange?: (value: Value) => void }) {
  const [value, setValue] = useState<Value>("food");
  return (
    <>
      <label htmlFor="category">Категория</label>
      <Select
        id="category"
        value={value}
        options={[...OPTIONS]}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </>
  );
}

const getTrigger = () => screen.getByRole("combobox", { name: "Категория" });

describe("Select", () => {
  it("shows the selected label and starts closed", () => {
    render(<Harness />);

    expect(getTrigger()).toHaveTextContent("Кафе / ресторан");
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getTrigger()).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("opens on click and marks the current value as selected", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(getTrigger());

    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option", { hidden: true });
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("selects an option by click, updates the label and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(getTrigger());
    await user.click(screen.getByRole("option", { name: "Цветочный магазин", hidden: true }));

    expect(onChange).toHaveBeenCalledWith("flowers");
    expect(getTrigger()).toHaveTextContent("Цветочный магазин");
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("supports keyboard: arrows move, Enter selects", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    getTrigger().focus();
    await user.keyboard("{ArrowDown}"); // открыть, активна текущая (food)
    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}"); // flowers
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("flowers");
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getTrigger()).toHaveFocus();
  });

  it("points aria-activedescendant at the highlighted option", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    getTrigger().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");

    const active = getTrigger().getAttribute("aria-activedescendant");
    expect(active).toBe("category-option-1");
    expect(document.getElementById(active as string)).toHaveTextContent("Пекарня / кондитерская");
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    getTrigger().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.keyboard("{Escape}");

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
    expect(getTrigger()).toHaveTextContent("Кафе / ресторан");
  });

  it("closes on an outside click", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseDown(document.body);
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("jumps to an option by its first letter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    getTrigger().focus();
    await user.keyboard("п"); // закрыт: "Пекарня…" выбирается сразу (первый по кругу после текущего)

    expect(onChange).toHaveBeenCalledWith("bakery");
  });
});
