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
