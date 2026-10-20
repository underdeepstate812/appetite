import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GeoPrompt, GeoStatusLine, MapLocateButton, geoMessage, type GeoState } from "./GeoControls";

const state = (over: Partial<GeoState> = {}): GeoState => ({ status: "idle", located: false, outside: false, ...over });

function line(geo: GeoState, over: Partial<React.ComponentProps<typeof GeoStatusLine>> = {}) {
  const props = { geo, sort: "hot" as const, onSort: vi.fn(), onLocate: vi.fn(), onReset: vi.fn(), ...over };
  render(<GeoStatusLine {...props} />);
  return props;
}

describe("geoMessage", () => {
  it("says honestly where the offers come from", () => {
    expect(geoMessage(state(), "hot")).toBe("Весь Санкт-Петербург");
    expect(geoMessage(state({ status: "locating" }), "hot")).toBe("Определяем, где вы…");
    expect(geoMessage(state({ status: "granted", located: true }), "near")).toBe("Рядом с вами · ближайшие первыми");
    expect(geoMessage(state({ status: "granted", located: true }), "hot")).toBe("Рядом с вами · горящие первыми");
    expect(geoMessage(state({ status: "granted", outside: true }), "hot")).toMatch(/за пределами Санкт-Петербурга/);
    expect(geoMessage(state({ status: "denied" }), "hot")).toMatch(/заблокирован/);
    expect(geoMessage(state({ status: "timeout" }), "hot")).toMatch(/вовремя/);
    expect(geoMessage(state({ status: "unavailable" }), "hot")).toMatch(/Не удалось/);
    expect(geoMessage(state({ status: "insecure" }), "hot")).toMatch(/HTTPS/);
  });
});

describe("GeoStatusLine", () => {
  it("idle: offers 'Рядом со мной' and asks only on the click", () => {
    const props = line(state());
    fireEvent.click(screen.getByRole("button", { name: /Рядом со мной/ }));
    expect(props.onLocate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group", { name: "Порядок предложений" })).toBeNull();
  });

  it("idle with the invitation already on screen: no duplicate 'Рядом со мной' next to it", () => {
    line(state(), { promptShown: true });
    expect(screen.queryByRole("button", { name: /Рядом со мной/ })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Весь Санкт-Петербург");
  });

  it("locating: no action buttons, just the status", () => {
    line(state({ status: "locating" }));
    expect(screen.getByRole("status")).toHaveTextContent("Определяем");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("located: 'Весь город' resets, and the order switch appears with the current choice pressed", () => {
    const props = line(state({ status: "granted", located: true }), { sort: "near" });
    expect(screen.getByRole("button", { name: "Ближайшие" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Сначала горящие" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Сначала горящие" }));
    expect(props.onSort).toHaveBeenCalledWith("hot");
    fireEvent.click(screen.getByRole("button", { name: /Весь город/ }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("outside the city: explains it and still lets the user reset, without the useless order switch", () => {
    line(state({ status: "granted", outside: true }));
    expect(screen.getByRole("status")).toHaveTextContent("за пределами Санкт-Петербурга");
    expect(screen.getByRole("button", { name: /Весь город/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Порядок предложений" })).toBeNull();
  });

  it("denied: explains how to enable it in site settings (collapsed until asked) and can retry", () => {
    const props = line(state({ status: "denied" }));
    expect(screen.queryByText(/Браузер запомнил отказ/)).toBeNull();
    const how = screen.getByRole("button", { name: "Как включить" });
    expect(how).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(how);
    expect(how).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Браузер запомнил отказ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(props.onLocate).toHaveBeenCalledTimes(1);
  });

  it("timeout: retry without the settings help", () => {
    line(state({ status: "timeout" }));
    expect(screen.getByRole("button", { name: /Повторить/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Как включить" })).toBeNull();
  });

  it("insecure page: only the explanation — a retry cannot help", () => {
    line(state({ status: "insecure" }));
    expect(screen.getByRole("status")).toHaveTextContent("HTTPS");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("GeoPrompt", () => {
  it("explains BEFORE the system dialog and offers a polite way out", () => {
    const onAllow = vi.fn();
    const onDismiss = vi.fn();
    render(<GeoPrompt onAllow={onAllow} onDismiss={onDismiss} />);
    expect(screen.getByText(/Показать ближайшие предложения первыми/)).toBeInTheDocument();
    expect(screen.getByText(/Браузер один раз спросит/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Определить местоположение" }));
    fireEvent.click(screen.getByRole("button", { name: "Не сейчас" }));
    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("MapLocateButton", () => {
  it("asks for the position when unknown, returns to it when known", () => {
    const onClick = vi.fn();
    const { rerender } = render(<MapLocateButton status="idle" located={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Определить моё местоположение" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<MapLocateButton status="granted" located onClick={onClick} />);
    expect(screen.getByRole("button", { name: "Вернуться к моему местоположению" })).toHaveClass("is-active");
  });

  it("is disabled while locating and on an insecure page", () => {
    const { rerender } = render(<MapLocateButton status="locating" located={false} onClick={() => {}} />);
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<MapLocateButton status="insecure" located={false} onClick={() => {}} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
