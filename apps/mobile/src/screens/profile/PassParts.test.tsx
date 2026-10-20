import React from "react";
import { render } from "@testing-library/react-native";
import "../../i18n";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { PassFooter } from "./PassFooter";
import { PassStats } from "./PassStats";
import { passSerial } from "../../utils/pass";

const wrap = (node: React.ReactNode) => render(<ThemeProvider>{node}</ThemeProvider>);

describe("PassFooter", () => {
  it("shows this user's pass number, and hides the decorative barcode from assistive tech", () => {
    const view = wrap(<PassFooter userId="u1" />);
    expect(view.getByText(`№ ${passSerial("u1")}`)).toBeTruthy();
    expect(view.getByText(`№ ${passSerial("u1")}`)).toBeTruthy();
  });

  it("is a different number for another user", () => {
    expect(wrap(<PassFooter userId="u2" />).queryByText(`№ ${passSerial("u1")}`)).toBeNull();
  });
});

describe("PassStats", () => {
  const eco = { totalPoints: 160, totalWeightSavedKg: 16, ordersCompleted: 52, level: { id: 2, minPoints: 50, icon: "" }, nextLevel: null } as never;

  it("labels the three numbers", () => {
    const view = wrap(<PassStats eco={eco} />);
    expect(view.getByText("БАЛЛЫ")).toBeTruthy();
    expect(view.getByText("КГ СПАСЕНО")).toBeTruthy();
    expect(view.getByText("ЗАКАЗОВ")).toBeTruthy();
  });

  it("holds the place with dashes until the eco data arrives", () => {
    expect(wrap(<PassStats eco={null} />).getAllByText("—")).toHaveLength(3);
  });
});
