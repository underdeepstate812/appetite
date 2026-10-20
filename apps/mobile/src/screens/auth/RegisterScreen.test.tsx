import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import "../../i18n";
import { RegisterScreen } from "./RegisterScreen";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { playHaptic } from "../../utils/haptics";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../../api/offers", () => ({ offersApi: { nearby: jest.fn(async () => []) } }));
jest.mock("../../api/auth", () => ({ authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn(), logout: jest.fn(), refresh: jest.fn() } }));
jest.mock("../../store/tokenStorage", () => ({ tokenStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}) } }));
jest.mock("../../utils/haptics", () => ({ playHaptic: jest.fn() }));

const register = authApi.register as jest.Mock;
const USER = { id: "u1", email: "qa@example.test", name: "QA", role: "USER" };
const FAKE_PASSWORD = "Qa-Fake-Pass-1!";

function setup() {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const props = { navigation: { navigate, canGoBack: () => true, goBack }, route: { key: "Register", name: "Register" } } as unknown;
  const view = render(
    <ThemeProvider>
      <RegisterScreen {...(props as React.ComponentProps<typeof RegisterScreen>)} />
    </ThemeProvider>
  );
  return { view, navigate, goBack };
}
const fill = (view: ReturnType<typeof setup>["view"], values: { name?: string; email?: string; phone?: string; password?: string }) => {
  if (values.name !== undefined) fireEvent.changeText(view.getByLabelText("Имя"), values.name);
  if (values.email !== undefined) fireEvent.changeText(view.getByLabelText("Email"), values.email);
  if (values.phone !== undefined) fireEvent.changeText(view.getByLabelText("Телефон (необязательно)"), values.phone);
  if (values.password !== undefined) fireEvent.changeText(view.getByLabelText("Пароль"), values.password);
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isHydrated: true, isLoading: false, error: null });
});

describe("RegisterScreen", () => {
  it("shows an error for every required field on an empty submit (phone is optional) and sends nothing", () => {
    const { view } = setup();
    fireEvent.press(view.getByRole("button", { name: "Зарегистрироваться" }));
    expect(view.getByText(/Укажите имя/)).toBeTruthy();
    expect(view.getByText("Введите email")).toBeTruthy();
    expect(view.getByText("Введите пароль")).toBeTruthy();
    expect(view.queryByText(/Номер в формате/)).toBeNull();
    expect(register).not.toHaveBeenCalled();
    expect(playHaptic).toHaveBeenCalledWith("warning");
  });

  it("requires an email — the old form let it through and the server rejected it", () => {
    const { view } = setup();
    fill(view, { name: "Аня", password: FAKE_PASSWORD });
    fireEvent.press(view.getByRole("button", { name: "Зарегистрироваться" }));
    expect(view.getByText("Введите email")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("updates the password checklist while typing", () => {
    const { view } = setup();
    const progress = () => view.getByLabelText(/Требования к паролю/).props.accessibilityLabel;
    expect(progress()).toContain("0 из 5");
    fill(view, { password: "Abcdefg1" });
    expect(progress()).toContain("4 из 5");
    fill(view, { password: FAKE_PASSWORD });
    expect(progress()).toContain("5 из 5");
  });

  it("blocks a weak password and an incomplete phone with specific messages", () => {
    const { view } = setup();
    fill(view, { name: "Аня", email: "qa@example.test", phone: "+7900", password: "Abcdefg1" });
    fireEvent.press(view.getByRole("button", { name: "Зарегистрироваться" }));
    expect(view.getByText(/Номер в формате/)).toBeTruthy();
    expect(view.getByText(/не соответствует требованиям/)).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers with trimmed values and leaves out an empty phone", async () => {
    register.mockResolvedValue({ user: USER, accessToken: "a", refreshToken: "r" });
    const { view } = setup();
    fill(view, { name: "  Аня ", email: " qa@example.test ", password: FAKE_PASSWORD });
    fireEvent.press(view.getByRole("button", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({ name: "Аня", email: "qa@example.test", password: FAKE_PASSWORD, phone: undefined });
  });

  it("normalises an optional phone number before sending", async () => {
    register.mockResolvedValue({ user: USER, accessToken: "a", refreshToken: "r" });
    const { view } = setup();
    fill(view, { name: "Аня", email: "qa@example.test", phone: "89001234567", password: FAKE_PASSWORD });
    fireEvent.press(view.getByRole("button", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ phone: "+79001234567" })));
  });

  it("shows a server error such as 'email already taken' and keeps what was typed", async () => {
    register.mockRejectedValue(new Error("Пользователь с таким email уже существует"));
    const { view } = setup();
    fill(view, { name: "Аня", email: "qa@example.test", password: FAKE_PASSWORD });
    fireEvent.press(view.getByRole("button", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(view.getByText("Пользователь с таким email уже существует")).toBeTruthy());
    expect(playHaptic).toHaveBeenCalledWith("error");
    expect(view.getByLabelText("Имя").props.value).toBe("Аня");
  });

  it("chains the keyboard: Next moves through the fields and Go submits", () => {
    const { view } = setup();
    expect(view.getByLabelText("Имя").props.returnKeyType).toBe("next");
    expect(view.getByLabelText("Email").props.returnKeyType).toBe("next");
    expect(view.getByLabelText("Телефон (необязательно)").props.returnKeyType).toBe("next");
    expect(view.getByLabelText("Пароль").props.returnKeyType).toBe("go");
    expect(view.getByLabelText("Пароль").props.autoComplete).toBe("new-password");
  });

  it("links back to sign-in", () => {
    const { view, navigate } = setup();
    fireEvent.press(view.getByRole("button", { name: "Уже есть аккаунт? Войти" }));
    expect(navigate).toHaveBeenCalledWith("Login");
  });
});
