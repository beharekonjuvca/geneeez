import { api } from "./client";

export async function corrMatrix(datasetId, payload) {
  const { data } = await api.post(`/datasets/${datasetId}/stats/corr`, payload);
  return data;
}

export async function pcaScores(datasetId, payload) {
  const { data } = await api.post(`/datasets/${datasetId}/stats/pca`, payload);
  return data;
}
