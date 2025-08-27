import { api } from "./client";

export async function listDatasets() {
  const { data } = await api.get("/datasets");
  return data;
}

export async function uploadDataset({ title, description, file }) {
  const fd = new FormData();
  fd.append("title", title);
  if (description) fd.append("description", description);
  fd.append("file", file);

  const { data } = await api.post("/datasets/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteDataset(id) {
  const { data } = await api.delete(`/datasets/${id}`);
  return data;
}
export async function getDatasetPreview(id, rows = 50) {
  const { data } = await api.get(`/datasets/${id}/preview`, {
    params: { rows },
  });
  return data;
}

export async function getDatasetSchema(id) {
  const { data } = await api.get(`/datasets/${id}/schema`);
  return data;
}

export async function downloadDataset(
  id,
  { format = "csv", columns = [] } = {}
) {
  const params = { format };
  if (columns.length) params.columns = columns.join(",");
  const resp = await api.get(`/datasets/${id}/download`, {
    params,
    responseType: "blob",
  });
  return resp.data;
}
