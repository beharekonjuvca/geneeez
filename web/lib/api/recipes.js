import { api } from "./client";

export async function listRecipes(datasetId) {
  const { data } = await api.get(`/recipes`, {
    params: { dataset_id: datasetId },
  });
  return data;
}

export async function saveRecipe(datasetId, name, panels) {
  const { data } = await api.post(`/recipes`, {
    dataset_id: datasetId,
    name,
    panels,
  });
  return data;
}

export async function updateRecipe(rid, { name, panels }) {
  const { data } = await api.put(`/recipes/${rid}`, { name, panels });
  return data;
}

export async function deleteRecipe(rid) {
  const { data } = await api.delete(`/recipes/${rid}`);
  return data;
}
