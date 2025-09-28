import { api } from "./client";

export async function adminStatsOverview(params = {}) {
  const { data } = await api.get("/admin/stats/overview", { params });
  return data;
}

export async function adminStatsLogs(params = {}) {
  const { data } = await api.get("/admin/stats/logs", { params });
  return data;
}
