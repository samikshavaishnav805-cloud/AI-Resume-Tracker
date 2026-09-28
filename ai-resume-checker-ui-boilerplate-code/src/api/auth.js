import { apiClient } from "./client";

export const authApi = {
  register: (payload) =>
    apiClient.post("/auth/register", payload).then((r) => r.data),

  login: (payload) =>
    apiClient.post("/auth/login", payload).then((r) => r.data),

  logout: () =>
    apiClient.post("/auth/logout").then((r) => r.data),

  me: () =>
    apiClient.get("/auth/me").then((r) => r.data),

  updateProfile: async () => {
    throw new Error("Profile update is not implemented yet");
  },

  changePassword: async () => {
    throw new Error("Password change is not implemented yet");
  },
};