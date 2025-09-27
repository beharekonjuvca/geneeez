import { api } from "./client";

export async function adminListUsers(params = {}) {
  const { data } = await api.get("/admin/users", { params });
  return data;
}
export async function adminCreateUser(payload) {
  const { data } = await api.post("/admin/users", payload);
  return data;
}
export async function adminUpdateUser(id, payload) {
  const { data } = await api.patch(`/admin/users/${id}`, payload);
  return data;
}
export async function adminDeleteUser(id) {
  await api.delete(`/admin/users/${id}`);
}
export async function adminCountUsers(params = {}) {
  const { data } = await api.get("/admin/users/count", { params });
  return data;
}
