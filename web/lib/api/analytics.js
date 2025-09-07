import { api } from "./client";

export async function listRecipeTemplates(datasetId) {
  const { data } = await api.get("/recipes", {
    params: { dataset_id: datasetId },
  });
  return data;
}

export async function runAnalysis(datasetId, body) {
  const { data } = await api.post(`/datasets/${datasetId}/analytics/run`, body);
  return data;
}

export async function getRun(runId) {
  const { data } = await api.get(`/analytics/runs/${runId}`);
  return data;
}
