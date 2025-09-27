import { api } from "./client";

export async function listDatasets({
  q,
  min_rows,
  max_rows,
  min_cols,
  max_cols,
  created_from,
  created_to,
  order_by,
  direction,
  limit,
  project_id,
} = {}) {
  const { data } = await api.get("/datasets", {
    params: {
      q,
      min_rows,
      max_rows,
      min_cols,
      max_cols,
      created_from,
      created_to,
      order_by,
      direction,
      limit,
      project_id,
    },
  });
  return data;
}

export async function uploadDataset({ title, description, file, project_id }) {
  const fd = new FormData();
  fd.append("title", title);
  if (description) fd.append("description", description);
  if (project_id) fd.append("project_id", String(project_id));
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
