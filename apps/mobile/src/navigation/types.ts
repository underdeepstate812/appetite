import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Orders: undefined;
  EcoProfile: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  OfferDetail: { offerId: string };
  Checkout: { offerId: string };
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

// Экраны внутри таб-бара могут переходить и на другие вкладки, и на экраны корневого
// стека (OfferDetail/Checkout) — поэтому типизируем композитно, как рекомендует
// официальный гайд React Navigation для вложенных навигаторов.
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
