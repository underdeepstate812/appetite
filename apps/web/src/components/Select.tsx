import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  /** id триггера — на него указывает <label htmlFor>, от него же строится id списка. */
  id: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * Собственный выпадающий список вместо нативного <select>: всплывающее окно
 * нативного select рисует ОС (серая панель macOS/Windows), CSS до него не
 * достаёт — в бренд-стиль его не привести. Здесь панель — стекло с фирменным
 * срезанным углом, тил-подсветкой и галочкой на выбранном пункте.
 *
 * Доступность — паттерн ARIA "select-only combobox": фокус всегда остаётся на
 * триггере, активный пункт указывается через aria-activedescendant.
 * Клавиши: ↑/↓/Home/End — навигация, Enter/Space — открыть/выбрать, Esc —
 * закрыть, Tab — закрыть и уйти дальше, буква — переход к пункту по первой букве.
 */
export function Select<T extends string>({ id, value, options, onChange, disabled }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const commit = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        // preventDefault, чтобы браузер не сгенерировал ещё и click и не переключил список второй раз.
        event.preventDefault();
        if (!open) openList();
        else commit(activeIndex);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const letter = event.key.toLowerCase();
          const start = open ? activeIndex + 1 : selectedIndex + 1;
          const ordered = Array.from({ length: options.length }, (_, offset) => (start + offset) % options.length);
          const match = ordered.find((index) => options[index].label.toLowerCase().startsWith(letter));
          if (match !== undefined) {
            event.preventDefault();
            if (open) setActiveIndex(match);
            else onChange(options[match].value);
          }
        }
    }
  };

  return (
    <div ref={rootRef} className={`select${open ? " is-open" : ""}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        // Space в некоторых браузерах кликает по keyup — гасим, иначе список откроется и сразу закроется.
        onKeyUp={(event) => {
          if (event.key === " ") event.preventDefault();
        }}
      >
        <span>{options[selectedIndex]?.label}</span>
        <ChevronDown size={18} strokeWidth={2.2} className="select-chevron" aria-hidden="true" />
      </button>

      <ul id={listId} role="listbox" className="select-panel" tabIndex={-1}>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={isSelected}
              className={`select-option${index === activeIndex ? " is-active" : ""}${isSelected ? " is-selected" : ""}`}
              style={{ "--i": index } as CSSProperties}
              // mousedown не должен уводить фокус с триггера — иначе aria-activedescendant теряет смысл.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              <span>{option.label}</span>
              {isSelected ? <Check size={17} strokeWidth={2.6} className="select-check" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
