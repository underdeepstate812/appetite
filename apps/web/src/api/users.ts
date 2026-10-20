import type { UpdateProfileRequest, User } from "@apetite/shared";
import { apiClient } from "./client";

export const usersApi = {
  /** Телефон сюда не входит: он нужен для входа и заказов, backend его не принимает. */
  updateProfile: (input: UpdateProfileRequest) => apiClient.patch<User>("/users/me", input),

  /** Фото профиля: JPEG/PNG/WebP до 5 МБ. */
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file, file.name || "avatar");
    return apiClient.post<User>("/users/me/avatar", form);
  },
};
