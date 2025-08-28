import { api } from "./client";

export async function runChart(datasetId, panel) {
  const { data } = await api.post(`/datasets/${datasetId}/chart`, panel);
  return data;
}
