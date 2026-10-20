import React, { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { getGridLayout, GRID_GAP } from "../utils/grid";

interface CardGridProps {
  /** Функция получает число колонок — так скелетон может рисовать ровно два ряда. */
  children: React.ReactNode | ((columns: number) => React.ReactNode);
}

/**
 * Сетка фиксированной ширины карточек (см. getGridLayout). Ширину контейнера берём
 * из onLayout, а не из размера окна: на карте/в планшете список может занимать
 * только часть экрана. Обёртки ячеек растягиваются по высоте строки (align-items:
 * stretch в каждой строке flex-wrap), поэтому карточки в ряду одной высоты.
 */
export function CardGrid({ children }: CardGridProps) {
  const [width, setWidth] = useState<number | null>(null);
  const { columns, cardWidth } = getGridLayout(width);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  };

  const content = typeof children === "function" ? children(columns) : children;

  return (
    <View style={styles.grid} onLayout={onLayout}>
      {React.Children.map(content, (child) => (
        <View style={cardWidth === null ? styles.fullRow : { width: cardWidth }}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  fullRow: { width: "100%" },
});
