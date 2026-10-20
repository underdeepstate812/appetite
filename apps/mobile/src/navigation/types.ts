import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  /** Страница перед входом: одна мысль и две кнопки. */
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  /** Только dev-сборка: тестовый показ новых элементов интерфейса (/ui-lab). */
  UiLab: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Orders: undefined;
  EcoProfile: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  // params опциональны — позволяет и navigation.navigate("Main"), и переход сразу
  // на конкретную вкладку через reset({ routes: [{ name: "Main", params: { screen: "Orders" } }] }).
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  OfferDetail: { offerId: string };
  Checkout: { offerId: string };
  OrderConfirmation: { orderId: string };
  OrderDetail: { orderId: string };
  Notifications: undefined;
  /** Только dev-сборка: тестовый показ новых элементов интерфейса (/ui-lab). */
  UiLab: undefined;
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
