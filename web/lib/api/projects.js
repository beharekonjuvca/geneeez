import { api } from "./client";

export async function listProjects(params = {}) {
  const { data } = await api.get("/projects", { params });
  return data;
}

export async function getProject(id, { include_counts = true } = {}) {
  const { data } = await api.get(`/projects/${id}`, {
    params: { include_counts },
  });
  return data;
}

export async function createProject({ name, description }) {
  const fd = new FormData();
  fd.append("name", name);
  if (description) fd.append("description", description);
  const { data } = await api.post("/projects", fd);
  return data;
}

export async function updateProject(id, { name, description }) {
  const fd = new FormData();
  if (name !== undefined) fd.append("name", name);
  if (description !== undefined) fd.append("description", description);
  const { data } = await api.patch(`/projects/${id}`, fd);
  return data;
}

export async function deleteProject(id) {
  await api.delete(`/projects/${id}`);
  return true;
}

export async function assignDatasetToProject(projectId, datasetId) {
  const { data } = await api.post(
    `/projects/${projectId}/datasets/${datasetId}`
  );
  return data;
}
export async function unassignDatasetFromProject(projectId, datasetId) {
  await api.delete(`/projects/${projectId}/datasets/${datasetId}`);
  return true;
}
