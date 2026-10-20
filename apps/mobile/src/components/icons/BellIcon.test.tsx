import React from "react";
import { render } from "@testing-library/react-native";
import { BellBody, BellClapper, BellWaves } from "./BellIcon";

describe("BellIcon layers", () => {
  it("draws the calm body as an outline with no fill", () => {
    const tree = JSON.stringify(render(<BellBody size={24} color="#0F766E" active={false} />).toJSON());

    expect(tree).toContain('"fillOpacity":0');
  });

  it("tints the body with the accent colour when there are unread notifications", () => {
    const tree = JSON.stringify(render(<BellBody size={24} color="#0F766E" active />).toJSON());

    expect(tree).toContain('"fillOpacity":0.18');
  });

  it("renders the clapper and the sound waves as separate layers", () => {
    expect(render(<BellClapper size={24} color="#0F766E" />).toJSON()).not.toBeNull();
    expect(render(<BellWaves size={24} color="#0F766E" />).toJSON()).not.toBeNull();
  });
});
