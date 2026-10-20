import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { CardGrid } from "./CardGrid";

// Ячейку создаёт сама сетка: поднимаемся от карточки до ближайшего предка с заданной шириной.
function widthsOf(view: ReturnType<typeof render>, ids: string[]) {
  return ids.map((id) => {
    let node = view.getByTestId(id).parent;
    while (node) {
      const width = StyleSheet.flatten(node.props.style)?.width;
      if (width !== undefined) return width;
      node = node.parent;
    }
    return undefined;
  });
}

describe("CardGrid", () => {
  const ids = ["a", "b", "c", "d"];
  const items = ids.map((id) => (
    <View key={id} testID={id}>
      <Text>{id}</Text>
    </View>
  ));

  it("renders every child and keeps one full-width column before it is measured", () => {
    const view = render(<CardGrid>{items}</CardGrid>);
    expect(widthsOf(view, ids)).toEqual(["100%", "100%", "100%", "100%"]);
  });

  it("gives every cell the same fixed width once the container is measured", () => {
    const view = render(<CardGrid>{items}</CardGrid>);
    fireEvent(view.UNSAFE_getAllByType(View)[0], "layout", { nativeEvent: { layout: { width: 1394, height: 0 } } });
    expect(widthsOf(view, ids)).toEqual([341, 341, 341, 341]);
  });

  it("passes the column count to a render function", () => {
    const seen: number[] = [];
    const view = render(
      <CardGrid>
        {(columns) => {
          seen.push(columns);
          return items;
        }}
      </CardGrid>
    );
    fireEvent(view.UNSAFE_getAllByType(View)[0], "layout", { nativeEvent: { layout: { width: 1000, height: 0 } } });
    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(3);
  });
});
