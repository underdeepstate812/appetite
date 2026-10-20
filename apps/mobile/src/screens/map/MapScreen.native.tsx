import React from "react";
import { NativeMapSurface } from "../../components/map/NativeMapSurface";
import { MapExperience } from "./MapExperience";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Map">;

/** iOS/Android: react-native-maps внутри общей раскладки MapExperience (лента карточек, выбор, список, геопозиция). */
export function MapScreen({ navigation }: Props) {
  return <MapExperience navigation={navigation} renderMap={(map) => <NativeMapSurface {...map} />} />;
}
