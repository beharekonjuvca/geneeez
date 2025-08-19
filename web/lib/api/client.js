import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080",
  withCredentials: true,
});

let accessToken = null;
export function setAccess(t) {
  accessToken = t;
}
export function getAccess() {
  return accessToken;
}

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshingPromise = null;

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const { config, response } = err;
    if (!response) return Promise.reject(err);

    const is401 = response.status === 401;
    const isAuthEndpoint =
      config?.url?.includes("/auth/refresh") ||
      config?.url?.includes("/auth/login") ||
      config?.url?.includes("/auth/signup") ||
      config?.url?.includes("/auth/logout");

    if (!is401 || isAuthEndpoint || config._retry) {
      return Promise.reject(err);
    }

    if (!refreshingPromise) {
      refreshingPromise = api
        .post("/auth/refresh")
        .then((r) => r.data.access)
        .finally(() => {
          refreshingPromise = null;
        });
    }

    const newAccess = await refreshingPromise;
    setAccess(newAccess);

    const retry = { ...config, _retry: true };
    retry.headers = {
      ...(retry.headers || {}),
      Authorization: `Bearer ${newAccess}`,
    };
    return api(retry);
  }
);
