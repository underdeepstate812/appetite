import { Platform } from "react-native";
import type { UpdateProfileRequest, User } from "@apetite/shared";
import { apiClient } from "./client";

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export const usersApi = {
  updateLocation: (lat: number, lng: number) => apiClient.patch<User>("/users/me/location", { lat, lng }),

  /** Телефон сюда не входит — обязателен для входа/заказов, backend его не примет. */
  updateProfile: (input: UpdateProfileRequest) => apiClient.patch<User>("/users/me", input),

  /** fileUri — локальный uri из expo-image-picker (file:// на native, blob:/data: на web). */
  uploadAvatar: async (fileUri: string, mimeType?: string | null) => {
    const formData = new FormData();

    if (Platform.OS === "web") {
      // На web FormData ждёт настоящий Blob/File — RN-форма { uri, name, type } там не работает.
      const blob = await (await fetch(fileUri)).blob();
      formData.append("avatar", blob, "avatar");
    } else {
      const filename = fileUri.split("/").pop() ?? "avatar.jpg";
      // RN-форма файла в FormData — официально документирована для multipart-загрузки.
      formData.append("avatar", {
        uri: fileUri,
        name: filename,
        type: mimeType ?? guessMime(filename),
      } as unknown as Blob);
    }

    return apiClient.post<User>("/users/me/avatar", formData);
  },
};
