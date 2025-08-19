import { api, setAccess } from "./client";

export async function apiSignup(email, password) {
  const { data } = await api.post("/auth/signup", { email, password });
  setAccess(data.access);
  return data;
}

export async function apiLogin(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  setAccess(data.access);
  return data;
}

export async function apiRefresh() {
  const { data } = await api.post("/auth/refresh");
  setAccess(data.access);
  return data;
}

export async function apiMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function apiLogout() {
  await api.post("/auth/logout");
  setAccess(null);
}
