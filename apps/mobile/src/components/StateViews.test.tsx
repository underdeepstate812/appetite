import React from "react";
import { render } from "@testing-library/react-native";
import "../i18n";
import { LoadingView } from "./StateViews";
import { ThemeProvider } from "../theme/ThemeProvider";

describe("LoadingView", () => {
  it("gives the spinner a name: on web it is role=progressbar and an unnamed one fails accessibility checks", () => {
    const view = render(<ThemeProvider><LoadingView label="Загрузка..." /></ThemeProvider>);
    expect(view.getByText("Загрузка...")).toBeTruthy();
    expect(view.getByLabelText("Загрузка...")).toBeTruthy();
  });
});
