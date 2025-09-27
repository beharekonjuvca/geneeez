import { api } from "./client";

export async function listAnalysisRuns(params = {}) {
  const { data } = await api.get("/analysis-runs", { params });
  return data;
}

export async function getAnalysisRun(id) {
  const { data } = await api.get(`/analysis-runs/${id}`);
  return data;
}
