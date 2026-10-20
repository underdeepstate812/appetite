import React from "react";
import { LeafletMapView } from "../../components/LeafletMapView";
import { MapExperience } from "./MapExperience";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Map">;

/**
 * react-native-maps не реализует web (его собственный MapView.web.ts — заглушка react-native-web UnimplementedView) —
 * здесь настоящая карта на Leaflet/OpenStreetMap (бесплатно, без API-ключа). Вся логика экрана (лента карточек, выбор,
 * список, геопозиция) — в MapExperience, одна для web и native; native-вариант — MapScreen.native.tsx.
 */
export function MapScreen({ navigation }: Props) {
  return (
    <MapExperience
      navigation={navigation}
      renderMap={(map) => (
        <LeafletMapView
          fill
          center={map.center}
          offers={map.offers}
          onSelectOffer={map.onSelectOffer}
          selectedId={map.selectedId}
          followSelection={map.followSelection}
          userPosition={map.userPosition}
          topInset={map.topInset}
          bottomInset={map.bottomInset}
          fitPoints={map.fitPoints}
          fitKey={map.fitKey}
          recenterKey={map.recenterKey}
        />
      )}
    />
  );
}
