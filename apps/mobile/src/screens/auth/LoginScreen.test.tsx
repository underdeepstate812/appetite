import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import "../../i18n";
import { LoginScreen } from "./LoginScreen";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { playHaptic } from "../../utils/haptics";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../../api/offers", () => ({ offersApi: { nearby: jest.fn(async () => []) } }));
jest.mock("../../api/auth", () => ({ authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn(), logout: jest.fn(), refresh: jest.fn() } }));
jest.mock("../../store/tokenStorage", () => ({ tokenStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}) } }));
jest.mock("../../utils/haptics", () => ({ playHaptic: jest.fn() }));

const login = authApi.login as jest.Mock;
const USER = { id: "u1", email: "qa@example.test", name: "QA", role: "USER" };
const FAKE_PASSWORD = "Qa-Fake-Pass-1!";

function setup() {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const props = { navigation: { navigate, canGoBack: () => true, goBack }, route: { key: "Login", name: "Login" } } as unknown;
  const view = render(
    <ThemeProvider>
      <LoginScreen {...(props as React.ComponentProps<typeof LoginScreen>)} />
    </ThemeProvider>
  );
  return { view, navigate, goBack };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isHydrated: true, isLoading: false, error: null });
});

describe("LoginScreen", () => {
  it("answers an empty submit with inline errors instead of a dead button, and does not call the API", () => {
    const { view } = setup();
    fireEvent.press(view.getByRole("button", { name: "Войти" }));
    expect(view.getByText("Введите email")).toBeTruthy();
    expect(view.getByText("Введите пароль")).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
    expect(playHaptic).toHaveBeenCalledWith("warning");
  });

  it("validates the email format and clears the error as soon as the user edits the field", () => {
    const { view } = setup();
    fireEvent.changeText(view.getByLabelText("Email"), "не-почта");
    fireEvent(view.getByLabelText("Email"), "blur");
    expect(view.getByText(/Проверьте email/)).toBeTruthy();
    fireEvent.changeText(view.getByLabelText("Email"), "qa@example.test");
    expect(view.queryByText(/Проверьте email/)).toBeNull();
  });

  it("submits trimmed credentials and signs in", async () => {
    login.mockResolvedValue({ user: USER, accessToken: "a", refreshToken: "r" });
    const { view } = setup();
    fireEvent.changeText(view.getByLabelText("Email"), "  qa@example.test ");
    fireEvent.changeText(view.getByLabelText("Пароль"), FAKE_PASSWORD);
    fireEvent.press(view.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith({ identifier: "qa@example.test", password: FAKE_PASSWORD }));
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("submits from the keyboard's 'go' key on the password field", async () => {
    login.mockResolvedValue({ user: USER, accessToken: "a", refreshToken: "r" });
    const { view } = setup();
    fireEvent.changeText(view.getByLabelText("Email"), "qa@example.test");
    fireEvent.changeText(view.getByLabelText("Пароль"), FAKE_PASSWORD);
    fireEvent(view.getByLabelText("Пароль"), "submitEditing");
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
  });

  it("shows the server's message in an alert block, keeps the input and buzzes", async () => {
    login.mockRejectedValue(new Error("Неверный логин или пароль"));
    const { view } = setup();
    fireEvent.changeText(view.getByLabelText("Email"), "qa@example.test");
    fireEvent.changeText(view.getByLabelText("Пароль"), "wrong");
    fireEvent.press(view.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(view.getByText("Неверный логин или пароль")).toBeTruthy());
    expect(playHaptic).toHaveBeenCalledWith("error");
    expect(view.getByLabelText("Email").props.value).toBe("qa@example.test");
  });

  it("lets the user reveal the password and hide it again", () => {
    const { view } = setup();
    expect(view.getByLabelText("Пароль").props.secureTextEntry).toBe(true);
    fireEvent.press(view.getByRole("button", { name: "Показать пароль" }));
    expect(view.getByLabelText("Пароль").props.secureTextEntry).toBe(false);
    fireEvent.press(view.getByRole("button", { name: "Скрыть пароль" }));
    expect(view.getByLabelText("Пароль").props.secureTextEntry).toBe(true);
  });

  it("declares autofill hints so password managers can fill the form", () => {
    const { view } = setup();
    expect(view.getByLabelText("Email").props.autoComplete).toBe("username");
    expect(view.getByLabelText("Пароль").props.autoComplete).toBe("current-password");
    expect(view.getByLabelText("Email").props.returnKeyType).toBe("next");
    expect(view.getByLabelText("Пароль").props.returnKeyType).toBe("go");
  });

  it("switches to phone sign-in, normalises the number and sends it as the identifier", async () => {
    login.mockResolvedValue({ user: USER, accessToken: "a", refreshToken: "r" });
    const { view } = setup();
    fireEvent.press(view.getByRole("button", { name: "Войти по номеру телефона" }));
    expect(view.getByLabelText("Телефон")).toBeTruthy();
    expect(view.getByRole("button", { name: "Войти по email" })).toBeTruthy();
    fireEvent.changeText(view.getByLabelText("Телефон"), "89001234567");
    expect(view.getByLabelText("Телефон").props.value).toBe("+79001234567");
    fireEvent.changeText(view.getByLabelText("Пароль"), FAKE_PASSWORD);
    fireEvent.press(view.getByRole("button", { name: "Войти" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith({ identifier: "+79001234567", password: FAKE_PASSWORD }));
  });

  it("rejects an incomplete phone number with a clear message", () => {
    const { view } = setup();
    fireEvent.press(view.getByRole("button", { name: "Войти по номеру телефона" }));
    fireEvent.changeText(view.getByLabelText("Телефон"), "+7900");
    fireEvent.changeText(view.getByLabelText("Пароль"), FAKE_PASSWORD);
    fireEvent.press(view.getByRole("button", { name: "Войти" }));
    expect(view.getByText(/Номер в формате/)).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it("links to registration", () => {
    const { view, navigate } = setup();
    fireEvent.press(view.getByRole("button", { name: "Нет аккаунта? Создать" }));
    expect(navigate).toHaveBeenCalledWith("Register");
  });
});
