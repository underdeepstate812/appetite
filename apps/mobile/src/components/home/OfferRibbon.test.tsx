import React from "react";
import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import "../../i18n";
import { OfferRibbon } from "./OfferRibbon";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { makeNearbyOffer } from "../../test/fixtures";
import { RIBBON_MIN_TO_DRIFT, ribbonGeometry } from "../../utils/ribbon";

// «Фитиль» анимирует длину JS-драйвером у каждой из десятков карточек и засыпает вывод act-предупреждениями; здесь он не предмет проверки.
jest.mock("../FuseTimer", () => ({ ...jest.requireActual("../FuseTimer"), FuseTimer: () => null }));

const offers = (n: number) => Array.from({ length: n }, (_, i) => makeNearbyOffer(`o${i}`, { title: `Блюдо ${i}`, businessName: `Кафе ${i}`, distanceKm: 0.5 + i }));
const HIDDEN = { includeHiddenElements: true };
const ALL_CARDS = /Открыть предложение$/; // копии петли скрыты от ролей, но подпись у них есть

async function setup(list = offers(5), props: Partial<React.ComponentProps<typeof OfferRibbon>> = {}) {
  const onPressOffer = jest.fn();
  const view = render(
    <ThemeProvider>
      <OfferRibbon offers={list} onPressOffer={onPressOffer} {...props} />
    </ThemeProvider>
  );
  await act(async () => {}); // ответ системы про «уменьшить движение» приходит асинхронно — ждём его внутри act
  fireEvent(view.getByTestId("offer-ribbon"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 98 } } });
  return { view, onPressOffer };
}

afterEach(() => jest.restoreAllMocks());

describe("OfferRibbon", () => {
  it("is a titled, labelled group with the number of offers", async () => {
    const { view } = await setup();
    expect(view.getByText("Сейчас на витрине")).toBeTruthy();
    expect(view.getByText("5")).toBeTruthy();
    expect(view.getByTestId("offer-ribbon").props.role).toBe("group");
    expect(view.getByTestId("offer-ribbon").props.accessibilityLabel).toMatch(/Лента предложений/);
  });

  it("repeats the set so the loop has no seam, but assistive tech sees each offer once", async () => {
    const { view } = await setup();
    const { copies } = ribbonGeometry(5, 390);
    expect(copies).toBeGreaterThanOrEqual(2);
    expect(view.getAllByRole("button")).toHaveLength(5);
    expect(view.getAllByLabelText(ALL_CARDS, HIDDEN)).toHaveLength(5 * copies);
    for (const card of view.getAllByRole("button")) expect(card.props.accessibilityLabel).toMatch(/Открыть предложение$/);
  });

  it("opens the tapped offer — also from a repeated copy", async () => {
    const { view, onPressOffer } = await setup();
    fireEvent.press(view.getAllByRole("button")[2]);
    expect(onPressOffer).toHaveBeenLastCalledWith(expect.objectContaining({ id: "o2" }));
    fireEvent.press(view.getAllByLabelText(ALL_CARDS, HIDDEN)[5 + 4]);
    expect(onPressOffer).toHaveBeenLastCalledWith(expect.objectContaining({ id: "o4" }));
  });

  it("draws the drifting track; with fewer than three offers it is a plain scrollable row instead", async () => {
    expect((await setup(offers(RIBBON_MIN_TO_DRIFT))).view.queryByTestId("offer-ribbon-track")).toBeTruthy();
    const few = await setup(offers(RIBBON_MIN_TO_DRIFT - 1));
    expect(few.view.queryByTestId("offer-ribbon-track")).toBeNull();
    expect(few.view.getAllByLabelText(ALL_CARDS, HIDDEN)).toHaveLength(RIBBON_MIN_TO_DRIFT - 1);
  });

  it("does not drift when the system asks to reduce motion: a scrollable row, every offer once", async () => {
    // Once: у AccessibilityInfo в jest «мок-функция», restoreAllMocks не возвращает ей прежний ответ — следующие тесты остались бы в reduce-motion.
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValueOnce(true);
    const { view } = await setup();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(view.queryByTestId("offer-ribbon-track")).toBeNull();
    expect(view.getAllByLabelText(ALL_CARDS, HIDDEN)).toHaveLength(5);
  });

  it("holds under a finger / pointer / focus and lets go only when all of them are gone — in any order of events", async () => {
    const { view } = await setup();
    const [first, second] = view.getAllByRole("button");
    const held = () => view.getByTestId("offer-ribbon").props.dataSet.held;
    expect(held()).toBe("0");
    act(() => void fireEvent(first, "hoverIn"));
    expect(held()).toBe("1");
    act(() => void fireEvent(second, "hoverIn")); // указатель перешёл на соседнюю: «вошёл» раньше, чем «вышел»
    act(() => void fireEvent(first, "hoverOut"));
    expect(held()).toBe("1");
    act(() => void fireEvent(second, "hoverOut"));
    expect(held()).toBe("0");
    act(() => void fireEvent(first, "pressIn"));
    act(() => void fireEvent(first, "focus"));
    act(() => void fireEvent(first, "pressOut"));
    expect(held()).toBe("1"); // фокус ещё держит
    act(() => void fireEvent(first, "blur"));
    expect(held()).toBe("0");
    act(() => void fireEvent(second, "hoverOut")); // лишнее «вышел» ничего не ломает
    expect(held()).toBe("0");
  });

  it("never stays frozen: a lost 'pointer left' event is cleared when the tab is left or the data changes", async () => {
    const { view } = await setup();
    const held = () => view.getByTestId("offer-ribbon").props.dataSet.held;
    act(() => void fireEvent(view.getAllByRole("button")[0], "hoverIn"));
    expect(held()).toBe("1");
    view.rerender(
      <ThemeProvider>
        <OfferRibbon offers={offers(5)} onPressOffer={jest.fn()} active={false} />
      </ThemeProvider>
    );
    expect(held()).toBe("0");
  });

  it("is not focusable twice: the repeated copies are out of the tab order", async () => {
    const { view } = await setup();
    const all = view.getAllByLabelText(ALL_CARDS, HIDDEN);
    expect(all.slice(0, 5).every((card) => card.props.focusable !== false)).toBe(true);
    expect(all.slice(5).every((card) => card.props.focusable === false)).toBe(true);
    expect(all.slice(5).every((card) => card.props["aria-hidden"] === true)).toBe(true);
  });
});
