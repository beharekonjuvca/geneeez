import { api } from "./client";

export async function getStatsSummary() {
  const { data } = await api.get("/dashboard/summary");
  return data;
}

export default { getStatsSummary };
