import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";

const updateProfile = vi.fn();
const uploadAvatar = vi.fn();
const setUser = vi.fn();
vi.mock("../api/users", () => ({ usersApi: { updateProfile: (...a: unknown[]) => updateProfile(...a), uploadAvatar: (...a: unknown[]) => uploadAvatar(...a) } }));
vi.mock("../api/eco", () => ({
  ecoApi: { me: () => Promise.resolve({ totalPoints: 63, totalWeightSavedKg: 6.3, ordersCompleted: 20, level: { id: 2, minPoints: 50, icon: "" }, nextLevel: { id: 3, minPoints: 200, icon: "" } }) },
}));
const user = { id: "u1", name: "Анна Петрова", email: "anna@example.ru", phone: "+79991234567", role: "USER", avatarUrl: null, createdAt: "2026-10-06T10:00:00Z" };
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user, isHydrated: true }),
  authActions: { setUser: (u: unknown) => setUser(u), logout: vi.fn().mockResolvedValue(undefined) },
}));

import { ProfilePage } from "./ProfilePage";
import { themeActions } from "../store/theme";

const renderPage = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>);
const edit = async (u: ReturnType<typeof userEvent.setup>) => u.click(screen.getByRole("button", { name: "Редактировать" }));

beforeEach(() => {
  updateProfile.mockReset();
  uploadAvatar.mockReset();
  setUser.mockReset();
  localStorage.clear();
});

describe("ProfilePage", () => {
  it("показывает пропуск: имя, уровень, «с нами с», цифры эко-профиля, контакты, номер", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Анна Петрова" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("63")).toBeInTheDocument());
    expect(screen.getByText("6.3")).toBeInTheDocument();
    expect(screen.getByText("СПАСАТЕЛЬ ЕДЫ")).toBeInTheDocument();
    expect(screen.getByText("С нами с октября 2026")).toBeInTheDocument();
    expect(screen.getByText("anna@example.ru")).toBeInTheDocument();
    expect(screen.getByText("+79991234567")).toBeInTheDocument();
    expect(screen.getByText("закреплён")).toBeInTheDocument();
    expect(screen.getByText(/^№ \d{3} \d{3}$/)).toBeInTheDocument();
    expect(await screen.findByText("До следующего уровня: 137 баллов")).toBeInTheDocument();
  });

  describe("правка данных", () => {
    it("форма с именем и email; телефон не редактируется и объяснено почему", async () => {
      const u = userEvent.setup();
      renderPage();
      await edit(u);
      expect(screen.getByLabelText("Имя")).toHaveValue("Анна Петрова");
      expect(screen.getByLabelText("Email")).toHaveValue("anna@example.ru");
      expect(screen.queryByLabelText("Телефон")).toBeNull();
      expect(screen.getByText(/Нельзя изменить — номер нужен для входа и заказов/)).toBeInTheDocument();
    });

    it("валидация: слишком короткое имя и кривой email — ошибки, запрос не уходит", async () => {
      const u = userEvent.setup();
      renderPage();
      await edit(u);
      await u.clear(screen.getByLabelText("Имя"));
      await u.type(screen.getByLabelText("Имя"), "А");
      await u.clear(screen.getByLabelText("Email"));
      await u.type(screen.getByLabelText("Email"), "не-почта");
      await u.click(screen.getByRole("button", { name: "Сохранить" }));
      expect(await screen.findByText("Имя — минимум 2 символа")).toBeInTheDocument();
      expect(screen.getByText("Некорректный email")).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it("шлёт только изменённое поле и обновляет профиль; показывает «Сохранено»", async () => {
      updateProfile.mockResolvedValue({ ...user, name: "Анна П." });
      const u = userEvent.setup();
      renderPage();
      await edit(u);
      await u.clear(screen.getByLabelText("Имя"));
      await u.type(screen.getByLabelText("Имя"), "Анна П.");
      await u.click(screen.getByRole("button", { name: "Сохранить" }));
      await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ name: "Анна П." }));
      expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ name: "Анна П." }));
      expect(await screen.findByText("Сохранено")).toBeInTheDocument();
      expect(screen.queryByLabelText("Имя")).toBeNull();
    });

    it("ничего не менял — запроса нет, форма закрывается", async () => {
      const u = userEvent.setup();
      renderPage();
      await edit(u);
      await u.click(screen.getByRole("button", { name: "Сохранить" }));
      expect(updateProfile).not.toHaveBeenCalled();
      expect(screen.queryByLabelText("Имя")).toBeNull();
    });

    it("ошибка сервера (email занят) показана, форма остаётся открытой с введёнными данными", async () => {
      updateProfile.mockRejectedValue(new ApiError(409, "Пользователь с таким email уже существует"));
      const u = userEvent.setup();
      renderPage();
      await edit(u);
      await u.clear(screen.getByLabelText("Email"));
      await u.type(screen.getByLabelText("Email"), "busy@example.ru");
      await u.click(screen.getByRole("button", { name: "Сохранить" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Пользователь с таким email уже существует");
      expect(screen.getByLabelText("Email")).toHaveValue("busy@example.ru");
      expect(setUser).not.toHaveBeenCalled();
    });

    it("«Отмена» возвращает просмотр без запроса", async () => {
      const u = userEvent.setup();
      renderPage();
      await edit(u);
      await u.type(screen.getByLabelText("Имя"), "ZZZ");
      await u.click(screen.getByRole("button", { name: "Отмена" }));
      expect(screen.getByRole("heading", { name: "Анна Петрова" })).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });
  });

  describe("фото", () => {
    const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });
    it("подходящий файл уходит на сервер, профиль обновляется", async () => {
      uploadAvatar.mockResolvedValue({ ...user, avatarUrl: "/uploads/avatars/a.jpg" });
      const u = userEvent.setup();
      renderPage();
      await u.upload(screen.getByTestId("avatar-input"), file("a.jpg", "image/jpeg"));
      await waitFor(() => expect(uploadAvatar).toHaveBeenCalled());
      expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: "/uploads/avatars/a.jpg" }));
    });
    it("не картинка и слишком большой файл отклоняются до отправки", async () => {
      const u = userEvent.setup({ applyAccept: false });
      renderPage();
      await u.upload(screen.getByTestId("avatar-input"), file("doc.pdf", "application/pdf"));
      expect(await screen.findByRole("alert")).toHaveTextContent("JPEG, PNG или WebP");
      await u.upload(screen.getByTestId("avatar-input"), file("big.png", "image/png", 5 * 1024 * 1024 + 1));
      expect(await screen.findByRole("alert")).toHaveTextContent("больше 5 МБ");
      expect(uploadAvatar).not.toHaveBeenCalled();
    });
    it("ошибка сервера при загрузке показана текстом", async () => {
      uploadAvatar.mockRejectedValue(new ApiError(400, "Разрешены только JPEG/PNG/WebP"));
      const u = userEvent.setup();
      renderPage();
      await u.upload(screen.getByTestId("avatar-input"), file("a.png", "image/png"));
      expect(await screen.findByRole("alert")).toHaveTextContent("Разрешены только JPEG/PNG/WebP");
    });
  });

  it("тема: три варианта, выбор применяется и подписывается", async () => {
    themeActions.init();
    const u = userEvent.setup();
    renderPage();
    const group = screen.getByRole("radiogroup", { name: "Тема оформления" });
    await u.click(within(group).getByRole("radio", { name: "Тёмная" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByTestId("theme-caption")).toHaveTextContent("Тёмная");
    expect(within(group).getByRole("radio", { name: "Тёмная" })).toHaveAttribute("aria-checked", "true");
    await u.click(within(group).getByRole("radio", { name: "Светлая" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("помощь: окно с темами, выбранная тема попадает в ссылку письма, Esc закрывает", async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByRole("button", { name: /Помощь и поддержка/ }));
    const dialog = screen.getByRole("dialog", { name: "Нужна помощь?" });
    await u.click(within(dialog).getByRole("radio", { name: "Оплата" }));
    const link = within(dialog).getByRole("link", { name: "Написать на почту" });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain("Appetite: Оплата");
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
